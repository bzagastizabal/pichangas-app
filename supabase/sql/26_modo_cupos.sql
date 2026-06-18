-- 26 — Modo de cupos por evento.
--
-- 'inmediato' (clásico, default):
--   "El que paga primero gana." Cuando un en_espera paga, desplaza al pendiente
--   más débil (sin pago vivo o con comprobante más nuevo).
--
-- 'tras_limite' (nuevo):
--   Antes de fecha_hora_limite_pago los inscritos tienen prioridad. Si un
--   en_espera paga durante ese periodo su pago queda aprobado pero NO desplaza
--   a nadie (la inscripción se queda en lista_espera con pago aprobado).
--   Después del límite, un en_espera que pague solo desplaza MOROSOS
--   (pendientes sin pago aprobado).
--
-- expirar_y_promover también mejora: si un lista_espera ya tiene pago aprobado
-- se promueve directo a 'confirmado' (no a 'pendiente' con nueva ventana).

-- ---------------------------------------------------------------------------
-- Enum y columna
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.modo_cupos as enum ('inmediato', 'tras_limite');
exception when duplicate_object then null; end $$;

alter table public.eventos
  add column if not exists modo_cupos public.modo_cupos not null default 'inmediato';

-- ---------------------------------------------------------------------------
-- aprobar_pago: respeta el modo_cupos del evento.
-- ---------------------------------------------------------------------------
create or replace function public.aprobar_pago(p_pago_id uuid)
returns public.pagos
language plpgsql security definer set search_path = public as $$
declare
  v_pago    pagos;
  v_insc    inscripciones;
  v_evento  eventos;
  v_tx      timestamptz;
  v_secured int;
  v_y       inscripciones;
  v_modo    public.modo_cupos;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede aprobar pagos.';
  end if;

  select * into v_pago from pagos where id = p_pago_id for update;
  if not found then raise exception 'El pago no existe.'; end if;

  select * into v_insc from inscripciones where id = v_pago.inscripcion_id for update;
  select * into v_evento from eventos where id = v_insc.evento_id for update;
  v_tx := v_pago.fecha_subida;
  v_modo := coalesce(v_evento.modo_cupos, 'inmediato'::public.modo_cupos);

  if v_insc.estado <> 'confirmado' then
    if v_insc.estado = 'lista_espera' then
      select count(*) into v_secured
      from inscripciones
      where evento_id = v_evento.id and estado in ('pendiente', 'confirmado');

      if v_secured >= v_evento.cupos_totales then
        -- Modo tras_limite + antes del límite: no se desplaza a nadie. Pago
        -- aprobado pero la inscripción queda en lista_espera esperando que
        -- pase el límite (entonces los morosos pierden cupo y el cron
        -- expirar_y_promover los promueve a 'confirmado').
        if v_modo = 'tras_limite' and now() < v_evento.fecha_hora_limite_pago then
          update pagos
            set estado = 'aprobado', fecha_validacion = now(),
                validado_por = auth.uid(), motivo_rechazo = null
            where id = p_pago_id
            returning * into v_pago;
          return v_pago;
        end if;

        if v_modo = 'tras_limite' then
          -- Después del límite: solo desplazar morosos (pendientes sin pago
          -- aprobado). FIFO por fecha_reserva (el más antiguo en mora pierde
          -- el cupo primero).
          select i.* into v_y
          from inscripciones i
          where i.evento_id = v_evento.id
            and i.estado = 'pendiente'
            and not exists (
              select 1 from pagos p
              where p.inscripcion_id = i.id and p.estado = 'aprobado'
            )
          order by i.fecha_reserva
          limit 1;
        else
          -- Modo clásico: pendiente más débil (sin pago vivo o con comprobante
          -- más nuevo que el actual). Misma lógica de SQL 07.
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
        end if;

        if v_y.id is null then
          -- Sin candidato a desplazar: aprobamos el pago pero la inscripción
          -- queda en lista_espera. La promoverá el cron cuando se abra cupo.
          update pagos
            set estado = 'aprobado', fecha_validacion = now(),
                validado_por = auth.uid(), motivo_rechazo = null
            where id = p_pago_id
            returning * into v_pago;
          return v_pago;
        end if;

        update inscripciones set estado = 'liberado' where id = v_y.id;
        perform public._notificar(
          v_y.usuario_id, v_evento.id, 'liberado',
          case when v_modo = 'tras_limite'
            then 'Tu cupo fue liberado: no pagaste antes de la fecha límite y otro jugador lo tomó.'
            else 'Tu cupo fue liberado: otro jugador pagó antes que tú.'
          end);
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
-- expirar_y_promover: un lista_espera con pago aprobado pasa directo a
-- 'confirmado' al promoverse (necesario para el modo tras_limite donde el
-- pago se aprueba antes que se abra el cupo).
-- ---------------------------------------------------------------------------
create or replace function public.expirar_y_promover()
returns table(expirados int, promovidos int)
language plpgsql security definer set search_path = public as $$
declare
  v_ev          eventos;
  v_insc        inscripciones;
  v_secured     int;
  v_exp         int := 0;
  v_prom        int := 0;
  v_nueva       timestamptz;
  v_tiene_pago  boolean;
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

      -- ¿Ya pagó? (caso típico del modo tras_limite donde pagó antes del límite)
      v_tiene_pago := exists (
        select 1 from pagos p
        where p.inscripcion_id = v_insc.id and p.estado = 'aprobado'
      );

      if v_tiene_pago then
        update inscripciones
          set estado = 'confirmado', posicion_lista = null
          where id = v_insc.id;
        perform public._notificar(
          v_insc.usuario_id, v_ev.id, 'confirmado',
          'Se liberó un cupo y como ya pagaste, ¡estás confirmado!');
      else
        v_nueva := least(now() + interval '24 hours', v_ev.fecha_hora_limite_pago);
        update inscripciones
          set estado = 'pendiente', fecha_expiracion = v_nueva, posicion_lista = null
          where id = v_insc.id;
        perform public._notificar(
          v_insc.usuario_id, v_ev.id, 'promovido',
          'Se liberó un cupo y ahora es tuyo: paga antes de la fecha límite.');
      end if;

      v_prom := v_prom + 1;
    end loop;
  end loop;

  return query select v_exp, v_prom;
end;
$$;
