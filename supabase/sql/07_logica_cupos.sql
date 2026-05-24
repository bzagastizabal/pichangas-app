-- supabase/sql/07_logica_cupos.sql
-- Fase 3 — Lógica de cupos atómica: regla "el que paga primero gana",
-- expiración automática y promoción de lista de espera.
-- Requiere 06_notificaciones.sql. Córrelo en Supabase SQL Editor.

-- Helper: registra una notificación (corre como definer, salta RLS de insert).
create or replace function public._notificar(
  p_uid uuid, p_evento uuid, p_tipo text, p_msg text
) returns void
language sql security definer set search_path = public as $$
  insert into notificaciones (usuario_id, evento_id, tipo, mensaje)
  values (p_uid, p_evento, p_tipo, p_msg);
$$;

-- ---------------------------------------------------------------------------
-- aprobar_pago: ahora aplica "el que paga primero gana".
-- - Si la inscripción es 'pendiente', ya ocupa cupo: solo se confirma.
-- - Si es 'lista_espera' y hay cupo libre: se confirma.
-- - Si es 'lista_espera' y NO hay cupo: se desplaza a un 'pendiente' cuyo
--   comprobante sea más nuevo que el que paga (o que no tenga comprobante).
--   El desplazado pasa a 'liberado'. El orden lo decide pagos.fecha_subida.
-- ---------------------------------------------------------------------------
create or replace function public.aprobar_pago(p_pago_id uuid)
returns public.pagos
language plpgsql security definer set search_path = public as $$
declare
  v_pago    pagos;
  v_insc    inscripciones;
  v_evento  eventos;
  v_tx      timestamptz;     -- fecha_subida del pago que se aprueba
  v_secured int;
  v_y       inscripciones;   -- pendiente a desplazar (si aplica)
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede aprobar pagos.';
  end if;

  select * into v_pago from pagos where id = p_pago_id for update;
  if not found then raise exception 'El pago no existe.'; end if;

  select * into v_insc from inscripciones where id = v_pago.inscripcion_id for update;
  -- Bloquea el evento para serializar la reasignación de cupos.
  select * into v_evento from eventos where id = v_insc.evento_id for update;
  v_tx := v_pago.fecha_subida;

  if v_insc.estado <> 'confirmado' then
    if v_insc.estado = 'lista_espera' then
      select count(*) into v_secured
      from inscripciones
      where evento_id = v_evento.id and estado in ('pendiente', 'confirmado');

      if v_secured >= v_evento.cupos_totales then
        -- Buscar el pendiente "más débil": sin pago vivo, o con pago más nuevo que v_tx.
        select i.* into v_y
        from inscripciones i
        where i.evento_id = v_evento.id
          and i.estado = 'pendiente'
          and (
            not exists (
              select 1 from pagos p
              where p.inscripcion_id = i.id and p.estado in ('en_revision', 'aprobado')
            )
            or (
              select max(p.fecha_subida) from pagos p
              where p.inscripcion_id = i.id and p.estado in ('en_revision', 'aprobado')
            ) > v_tx
          )
        order by
          (case when not exists (
              select 1 from pagos p
              where p.inscripcion_id = i.id and p.estado in ('en_revision', 'aprobado')
            ) then 0 else 1 end) asc,
          (select max(p.fecha_subida) from pagos p
             where p.inscripcion_id = i.id and p.estado in ('en_revision', 'aprobado')
          ) desc nulls first
        limit 1;

        if v_y.id is null then
          raise exception 'No hay cupo: los pendientes pagaron antes que este comprobante.';
        end if;

        update inscripciones set estado = 'liberado' where id = v_y.id;
        perform public._notificar(
          v_y.usuario_id, v_evento.id, 'liberado',
          'Tu cupo fue liberado: otro jugador pagó antes que tú.');
      end if;
    end if;

    update inscripciones set estado = 'confirmado' where id = v_insc.id;
    perform public._notificar(
      v_insc.usuario_id, v_evento.id, 'confirmado',
      'Tu pago fue aprobado. ¡Cupo confirmado!');
  end if;

  update pagos
    set estado = 'aprobado', fecha_validacion = now(),
        validado_por = auth.uid(), motivo_rechazo = null
    where id = p_pago_id
    returning * into v_pago;

  return v_pago;
end;
$$;

-- ---------------------------------------------------------------------------
-- expirar_y_promover: la corre el cron cada ~5 min.
-- 1) 'pendiente' vencidos SIN comprobante vivo -> 'expirado'.
-- 2) Mientras quede cupo, promueve al primero de 'lista_espera' a 'pendiente'
--    con una nueva ventana de pago (24 h, sin pasar del límite del evento).
-- ---------------------------------------------------------------------------
create or replace function public.expirar_y_promover()
returns table(expirados int, promovidos int)
language plpgsql security definer set search_path = public as $$
declare
  v_ev      eventos;
  v_insc    inscripciones;
  v_secured int;
  v_exp     int := 0;
  v_prom    int := 0;
  v_nueva   timestamptz;
begin
  for v_ev in select * from eventos where estado = 'abierta' for update loop
    -- 1) Expirar pendientes vencidos sin pago vivo.
    for v_insc in
      select * from inscripciones i
      where i.evento_id = v_ev.id
        and i.estado = 'pendiente'
        and i.fecha_expiracion is not null
        and i.fecha_expiracion < now()
        and not exists (
          select 1 from pagos p
          where p.inscripcion_id = i.id and p.estado in ('en_revision', 'aprobado')
        )
    loop
      update inscripciones set estado = 'expirado' where id = v_insc.id;
      perform public._notificar(
        v_insc.usuario_id, v_ev.id, 'expirado',
        'Tu reserva expiró por falta de pago a tiempo.');
      v_exp := v_exp + 1;
    end loop;

    -- 2) Promover lista de espera mientras haya cupo.
    loop
      select count(*) into v_secured
      from inscripciones
      where evento_id = v_ev.id and estado in ('pendiente', 'confirmado');
      exit when v_secured >= v_ev.cupos_totales;

      select * into v_insc
      from inscripciones
      where evento_id = v_ev.id and estado = 'lista_espera'
      order by posicion_lista asc nulls last, fecha_reserva asc
      limit 1;
      exit when not found;

      v_nueva := least(now() + interval '24 hours', v_ev.fecha_hora_limite_pago);
      update inscripciones
        set estado = 'pendiente', fecha_expiracion = v_nueva, posicion_lista = null
        where id = v_insc.id;
      perform public._notificar(
        v_insc.usuario_id, v_ev.id, 'promovido',
        'Se liberó un cupo y ahora es tuyo: paga antes de la fecha límite.');
      v_prom := v_prom + 1;
    end loop;
  end loop;

  return query select v_exp, v_prom;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agenda el cron cada 5 minutos (pg_cron).
-- Si "create extension pg_cron" falla, habilítalo en Dashboard -> Database ->
-- Extensions y vuelve a correr desde aquí.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

-- Reemplaza el job si ya existía (idempotente).
select cron.unschedule(jobid) from cron.job where jobname = 'expirar-y-promover';
select cron.schedule('expirar-y-promover', '*/5 * * * *',
                     $$ select public.expirar_y_promover(); $$);
