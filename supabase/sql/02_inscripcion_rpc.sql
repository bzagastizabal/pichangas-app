-- supabase/sql/02_inscripcion_rpc.sql
-- Fase 2 — Reserva de cupo ATÓMICA.
-- Córrelo en Supabase: Dashboard -> SQL Editor -> pega y RUN.
--
-- Por qué una función y no insertar desde la app:
-- contar inscritos y decidir "pendiente" vs "lista_espera" debe ser atómico,
-- o dos personas que pulsan "Inscribirme" a la vez podrían tomar el mismo cupo.
-- Bloqueamos la fila del evento con SELECT ... FOR UPDATE para serializar.
--
-- SECURITY DEFINER: corre como dueño y así puede CONTAR las inscripciones de
-- TODOS (la RLS solo deja a cada participante ver las suyas). Igual forzamos
-- usuario_id = auth.uid(), nadie inscribe a otro.

create or replace function public.inscribirse(p_evento_id uuid)
returns public.inscripciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_evento    eventos;
  v_existente inscripciones;
  v_ocupados  int;
  v_pos       int;
  v_nueva     inscripciones;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para inscribirte.';
  end if;

  -- Serializa inscripciones concurrentes sobre el mismo evento.
  select * into v_evento from eventos where id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;

  if v_evento.estado <> 'abierta' then
    raise exception 'Las inscripciones no están abiertas para este evento.';
  end if;

  -- Idempotente: si ya tiene una inscripción viva, la devolvemos.
  select * into v_existente
  from inscripciones
  where evento_id = p_evento_id
    and usuario_id = v_uid
    and estado in ('pendiente', 'confirmado', 'lista_espera')
  limit 1;
  if found then
    return v_existente;
  end if;

  -- Cupos ocupados = pendientes + confirmados.
  select count(*) into v_ocupados
  from inscripciones
  where evento_id = p_evento_id
    and estado in ('pendiente', 'confirmado');

  if v_ocupados < v_evento.cupos_totales then
    -- Hay cupo: queda 'pendiente' con ventana de pago hasta el límite del evento.
    insert into inscripciones (evento_id, usuario_id, estado, fecha_expiracion)
    values (p_evento_id, v_uid, 'pendiente', v_evento.fecha_hora_limite_pago)
    returning * into v_nueva;
  else
    -- Lleno: va a lista de espera al final de la cola.
    select coalesce(max(posicion_lista), 0) + 1 into v_pos
    from inscripciones
    where evento_id = p_evento_id and estado = 'lista_espera';

    insert into inscripciones (evento_id, usuario_id, estado, posicion_lista)
    values (p_evento_id, v_uid, 'lista_espera', v_pos)
    returning * into v_nueva;
  end if;

  return v_nueva;
end;
$$;

grant execute on function public.inscribirse(uuid) to authenticated;

-- OPCIONAL (no requerido para que funcione): si quieres que el enlace muestre
-- los datos del evento ANTES de iniciar sesión (hoy un anónimo no ve nada),
-- descomenta una política de lectura pública de eventos abiertos:
--
-- create policy "eventos abiertos visibles a todos"
--   on public.eventos for select
--   to anon
--   using (estado = 'abierta');
