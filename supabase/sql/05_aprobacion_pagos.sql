-- supabase/sql/05_aprobacion_pagos.sql
-- Fase 2 — Aprobación / rechazo de pagos por el admin.
-- Córrelo en Supabase: Dashboard -> SQL Editor -> pega y RUN.
--
-- Atómico: aprobar marca el pago como 'aprobado' Y confirma la inscripción
-- en la misma operación. SECURITY DEFINER + chequeo es_admin() (doble barrera).
--
-- NOTA: la lógica de "el que paga primero gana" (desplazar a un pendiente con
-- comprobante más nuevo cuando no hay cupo) es de Fase 3; aquí la aprobación
-- solo pasa la inscripción de 'pendiente' a 'confirmado' (mismo cupo, sin sobreventa).

create or replace function public.aprobar_pago(p_pago_id uuid)
returns public.pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede aprobar pagos.';
  end if;

  select * into v_pago from pagos where id = p_pago_id for update;
  if not found then
    raise exception 'El pago no existe.';
  end if;

  update pagos
    set estado = 'aprobado',
        fecha_validacion = now(),
        validado_por = auth.uid(),
        motivo_rechazo = null
    where id = p_pago_id
    returning * into v_pago;

  update inscripciones
    set estado = 'confirmado'
    where id = v_pago.inscripcion_id;

  return v_pago;
end;
$$;

create or replace function public.rechazar_pago(p_pago_id uuid, p_motivo text)
returns public.pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede rechazar pagos.';
  end if;

  -- La inscripción sigue 'pendiente': el jugador puede subir otro comprobante.
  update pagos
    set estado = 'rechazado',
        fecha_validacion = now(),
        validado_por = auth.uid(),
        motivo_rechazo = nullif(trim(p_motivo), '')
    where id = p_pago_id
    returning * into v_pago;

  if not found then
    raise exception 'El pago no existe.';
  end if;

  return v_pago;
end;
$$;

grant execute on function public.aprobar_pago(uuid) to authenticated;
grant execute on function public.rechazar_pago(uuid, text) to authenticated;
