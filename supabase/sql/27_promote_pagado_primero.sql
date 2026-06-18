-- 27 — Prioridad de promoción de lista_espera en modo tras_limite.
--
-- Caso real: el cron promovió FIFO. Cuando había un en_espera sin pago en
-- posición 1 y otro con pago aprobado en posición 2, el primero ocupaba el
-- cupo libre (pasando a 'pendiente' con fecha_expiracion en el pasado), y
-- el con pago aprobado quedaba esperando una segunda corrida del cron para
-- que se expirara el de adelante. Ineficiente y propenso a quedar atascado
-- si pg_cron está caído.
--
-- En modo 'tras_limite' tiene más sentido promover primero a quien ya pagó:
-- es el que el sistema quiere que tenga el cupo. En modo 'inmediato' (clásico)
-- la promoción sigue siendo FIFO pura por posición/fecha_reserva.

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
    --    En modo tras_limite los que ya pagaron tienen prioridad. En modo
    --    inmediato sigue siendo FIFO puro.
    loop
      select count(*) into v_secured
      from inscripciones
      where evento_id = v_ev.id and estado in ('pendiente', 'confirmado');
      exit when v_secured >= v_ev.cupos_totales;

      if coalesce(v_ev.modo_cupos, 'inmediato'::public.modo_cupos) = 'tras_limite' then
        -- Pagado primero, después FIFO.
        select i.* into v_insc
        from inscripciones i
        where i.evento_id = v_ev.id and i.estado = 'lista_espera'
        order by
          (case when exists (
            select 1 from pagos p
            where p.inscripcion_id = i.id and p.estado = 'aprobado'
          ) then 0 else 1 end) asc,
          i.posicion_lista asc nulls last,
          i.fecha_reserva asc
        limit 1;
      else
        -- Modo clásico: FIFO puro.
        select * into v_insc
        from inscripciones
        where evento_id = v_ev.id and estado = 'lista_espera'
        order by posicion_lista asc nulls last, fecha_reserva asc
        limit 1;
      end if;
      exit when not found;

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
