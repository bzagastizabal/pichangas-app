-- SQL 38 — Reloj del marcador: RPC atomica + revision anti-desincronizacion.
--
-- Problema que arregla:
--   1) Las acciones del reloj (play/reset/ajuste) hacian SELECT y luego UPDATE
--      desde el Server Action. Si el operador tocaba dos botones seguidos, el
--      segundo leia la fila ANTES de que el primero escribiera (read-modify-
--      write) y el estado final quedaba mezclado: reset seguido de play podia
--      terminar pausado en el tiempo viejo.
--   2) Un UPDATE lento podia llegar por Realtime DESPUES de uno mas nuevo y
--      pisar el estado bueno. Ahora cada UPDATE incrementa `rev` y el cliente
--      ignora los payloads con rev menor.
--
-- La RPC hace todo en una transaccion con SELECT ... FOR UPDATE, asi que dos
-- operadores (o dos toques rapidos) se serializan en el servidor.

alter table public.marcadores
  add column if not exists rev bigint not null default 0;

create or replace function public.marcadores_bump_rev() returns trigger
language plpgsql as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_marcadores_rev on public.marcadores;
create trigger trg_marcadores_rev
  before update on public.marcadores
  for each row execute function public.marcadores_bump_rev();

-- p_accion: 'play' (alterna), 'reset' (al total del periodo), 'ajuste' (±seg).
-- Devuelve la fila resultante: el cliente la aplica tal cual (es la verdad) y
-- de paso se entera del `rev` con el que quedo.
create or replace function public.marcador_reloj(
  p_id uuid,
  p_accion text,
  p_delta int default 0
) returns public.marcadores
language plpgsql security definer set search_path = public as $$
declare
  m public.marcadores;
  v_restante int;
  v_shot int;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede operar el reloj.';
  end if;

  select * into m from public.marcadores where id = p_id for update;
  if not found then
    raise exception 'Marcador no encontrado.';
  end if;

  -- ms reales restantes AHORA (mismo calculo que hace el cliente sin drift).
  v_restante := case
    when m.reloj_corriendo and m.reloj_inicio is not null
      then greatest(0, m.reloj_restante_ms
                       - (extract(epoch from (now() - m.reloj_inicio)) * 1000)::int)
    else m.reloj_restante_ms end;
  v_shot := case
    when m.shot_corriendo and m.shot_inicio is not null
      then greatest(0, m.shot_restante_ms
                       - (extract(epoch from (now() - m.shot_inicio)) * 1000)::int)
    else m.shot_restante_ms end;

  if p_accion = 'play' then
    if m.reloj_corriendo then
      update public.marcadores set
        reloj_restante_ms = v_restante, reloj_corriendo = false, reloj_inicio = null,
        shot_restante_ms  = v_shot,     shot_corriendo  = false, shot_inicio  = null
      where id = p_id returning * into m;
    else
      update public.marcadores set
        reloj_corriendo = true, reloj_inicio = now(),
        shot_corriendo  = true, shot_inicio  = now()
      where id = p_id returning * into m;
    end if;

  elsif p_accion = 'reset' then
    -- Solo el reloj de periodo (el shot tiene sus propios botones 24/14).
    update public.marcadores set
      reloj_restante_ms = m.duracion_periodo_seg * 1000,
      reloj_corriendo = false,
      reloj_inicio = null
    where id = p_id returning * into m;

  elsif p_accion = 'ajuste' then
    update public.marcadores set
      reloj_restante_ms = greatest(0, v_restante + p_delta * 1000),
      -- Si corre, re-anclamos el inicio para no perder los ms ya consumidos.
      reloj_inicio = case when m.reloj_corriendo then now() else m.reloj_inicio end
    where id = p_id returning * into m;

  else
    raise exception 'Accion de reloj invalida: %', p_accion;
  end if;

  return m;
end;
$$;

grant execute on function public.marcador_reloj(uuid, text, int) to authenticated;
