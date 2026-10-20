-- SQL 39 — Link publico de OPERADOR del cronometro.
--
-- Caso: el que toma el tiempo en la cancha no es admin y no tiene sesion. Le
-- pasamos un link con una clave secreta que habilita SOLO los controles de
-- tiempo (play/pausa, reset, ±segundos y bocina). Nada de colores, avisos,
-- packs de voz ni duracion total: eso sigue siendo exclusivo del admin.
--
-- La clave vive en una TABLA APARTE a proposito: `marcadores` tiene SELECT
-- publico (cualquiera que abre el visor lee la fila), asi que una columna con
-- la clave se la regalaria a todos los espectadores.

create table if not exists public.marcador_claves (
  marcador_id uuid primary key references public.marcadores(id) on delete cascade,
  clave text not null unique,
  created_at timestamptz not null default now()
);

alter table public.marcador_claves enable row level security;

-- Nadie lee esta tabla salvo el admin; el operador nunca la consulta (su
-- clave se valida dentro de funciones SECURITY DEFINER).
drop policy if exists "marcador_claves_admin" on public.marcador_claves;
create policy "marcador_claves_admin" on public.marcador_claves
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on public.marcador_claves to authenticated;

-- 18 chars hex (~72 bits): no adivinable por fuerza bruta.
create or replace function public.marcador_clave_nueva() returns text
language sql volatile as $$ select encode(gen_random_bytes(9), 'hex') $$;

-- Cada marcador nace con su clave.
create or replace function public.marcador_crea_clave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.marcador_claves (marcador_id, clave)
  values (new.id, public.marcador_clave_nueva())
  on conflict (marcador_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_marcador_clave on public.marcadores;
create trigger trg_marcador_clave
  after insert on public.marcadores
  for each row execute function public.marcador_crea_clave();

-- Backfill de los marcadores que ya existian.
insert into public.marcador_claves (marcador_id, clave)
select id, public.marcador_clave_nueva() from public.marcadores
on conflict (marcador_id) do nothing;

-- ---------------------------------------------------------------------------
-- Logica del reloj, compartida por el RPC de admin y el de operador. Sale del
-- cuerpo de SQL 38 (misma semantica) y suma la accion 'bocina'.
create or replace function public.marcador_reloj_aplicar(
  p_id uuid,
  p_accion text,
  p_delta int
) returns public.marcadores
language plpgsql security definer set search_path = public as $$
declare
  m public.marcadores;
  v_restante int;
  v_shot int;
begin
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

  elsif p_accion = 'bocina' then
    update public.marcadores set bocina_pulsos = bocina_pulsos + 1
    where id = p_id returning * into m;

  else
    raise exception 'Accion de reloj invalida: %', p_accion;
  end if;

  return m;
end;
$$;

-- Admin: misma firma de SQL 38, ahora delegando el cuerpo.
create or replace function public.marcador_reloj(
  p_id uuid,
  p_accion text,
  p_delta int default 0
) returns public.marcadores
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede operar el reloj.';
  end if;
  return public.marcador_reloj_aplicar(p_id, p_accion, p_delta);
end;
$$;

grant execute on function public.marcador_reloj(uuid, text, int) to authenticated;

-- Operador por link: valida slug + clave y limita lo que puede hacer.
create or replace function public.marcador_reloj_op(
  p_slug text,
  p_clave text,
  p_accion text,
  p_delta int default 0
) returns public.marcadores
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_accion not in ('play', 'reset', 'ajuste', 'bocina') then
    raise exception 'Accion no permitida para el operador: %', p_accion;
  end if;
  -- El ajuste se acota: un link filtrado no puede poner horas de mas.
  if p_accion = 'ajuste' and abs(coalesce(p_delta, 0)) > 60 then
    raise exception 'Ajuste fuera de rango.';
  end if;

  select m.id into v_id
  from public.marcadores m
  join public.marcador_claves k on k.marcador_id = m.id
  where m.slug = p_slug and k.clave = p_clave and m.expira_en > now();

  if v_id is null then
    raise exception 'Link de operador invalido o vencido.';
  end if;

  return public.marcador_reloj_aplicar(v_id, p_accion, p_delta);
end;
$$;

grant execute on function public.marcador_reloj_op(text, text, text, int) to anon, authenticated;

-- Solo valida (sin mutar): la pagina decide si muestra el dock de operador.
create or replace function public.marcador_clave_valida(p_slug text, p_clave text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.marcadores m
    join public.marcador_claves k on k.marcador_id = m.id
    where m.slug = p_slug and k.clave = p_clave and m.expira_en > now()
  );
$$;

grant execute on function public.marcador_clave_valida(text, text) to anon, authenticated;

-- Si el link se filtro, el admin lo rota y el anterior deja de servir.
create or replace function public.marcador_clave_regenerar(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_clave text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede regenerar el link.';
  end if;
  v_clave := public.marcador_clave_nueva();
  insert into public.marcador_claves (marcador_id, clave) values (p_id, v_clave)
  on conflict (marcador_id) do update set clave = excluded.clave;
  return v_clave;
end;
$$;

grant execute on function public.marcador_clave_regenerar(uuid) to authenticated;
