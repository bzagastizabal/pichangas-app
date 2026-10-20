-- SQL 40 — Panel de efectos de sonido del cronometro ("soundboard").
--
-- Caso: sonar un efecto cuando alguien encesta, falla solo o para hacer una
-- broma. Los sube el admin en /admin/sonidos y se disparan desde el propio
-- cronometro, tambien desde el link publico de operador (SQL 39) — ahi SOLO
-- se usan, nunca se editan.
--
-- Como viaja el disparo: igual que la bocina (SQL 28), con un contador
-- monotonico en la fila del marcador. El visor escucha por Realtime y cuando
-- `efecto_pulsos` sube reproduce el clip que indica `efecto_actual`. Asi suena
-- en el proyector (el que tiene parlantes), no solo en el movil del operador.

insert into storage.buckets (id, name, public)
values ('efectos', 'efectos', true)
on conflict (id) do nothing;

drop policy if exists "efectos_read"         on storage.objects;
drop policy if exists "efectos_admin_write"  on storage.objects;
drop policy if exists "efectos_admin_update" on storage.objects;
drop policy if exists "efectos_admin_delete" on storage.objects;

create policy "efectos_read" on storage.objects
  for select to public using (bucket_id = 'efectos');
create policy "efectos_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'efectos' and public.es_admin());
create policy "efectos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'efectos' and public.es_admin())
  with check (bucket_id = 'efectos' and public.es_admin());
create policy "efectos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'efectos' and public.es_admin());

create table if not exists public.efectos_sonido (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  emoji text,
  path text not null,                 -- ruta dentro del bucket 'efectos'
  orden int not null default 0,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists efectos_sonido_orden_idx on public.efectos_sonido(orden, created_at);

alter table public.efectos_sonido enable row level security;

-- Lectura publica: el visor (sin sesion) necesita la lista y las rutas.
drop policy if exists "efectos_sonido_read" on public.efectos_sonido;
create policy "efectos_sonido_read" on public.efectos_sonido
  for select to anon, authenticated using (true);
drop policy if exists "efectos_sonido_admin" on public.efectos_sonido;
create policy "efectos_sonido_admin" on public.efectos_sonido
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select on public.efectos_sonido to anon, authenticated;
grant insert, update, delete on public.efectos_sonido to authenticated;

alter table public.marcadores
  add column if not exists efecto_pulsos int not null default 0,
  add column if not exists efecto_actual uuid
    references public.efectos_sonido(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Disparo. Cuerpo comun + una puerta por tipo de usuario (admin / operador),
-- igual que el reloj de SQL 39.
create or replace function public.marcador_efecto_aplicar(p_id uuid, p_efecto uuid)
returns public.marcadores
language plpgsql security definer set search_path = public as $$
declare m public.marcadores;
begin
  if not exists (select 1 from public.efectos_sonido e where e.id = p_efecto and e.activo) then
    raise exception 'Efecto inexistente o desactivado.';
  end if;
  update public.marcadores
     set efecto_pulsos = efecto_pulsos + 1,
         efecto_actual = p_efecto
   where id = p_id
   returning * into m;
  if not found then
    raise exception 'Marcador no encontrado.';
  end if;
  return m;
end;
$$;

create or replace function public.marcador_efecto(p_id uuid, p_efecto uuid)
returns public.marcadores
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede disparar efectos.';
  end if;
  return public.marcador_efecto_aplicar(p_id, p_efecto);
end;
$$;

grant execute on function public.marcador_efecto(uuid, uuid) to authenticated;

create or replace function public.marcador_efecto_op(p_slug text, p_clave text, p_efecto uuid)
returns public.marcadores
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select m.id into v_id
  from public.marcadores m
  join public.marcador_claves k on k.marcador_id = m.id
  where m.slug = p_slug and k.clave = p_clave and m.expira_en > now();

  if v_id is null then
    raise exception 'Link de operador invalido o vencido.';
  end if;

  return public.marcador_efecto_aplicar(v_id, p_efecto);
end;
$$;

grant execute on function public.marcador_efecto_op(text, text, uuid) to anon, authenticated;
