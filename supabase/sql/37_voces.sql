-- SQL 37 — Packs de voz para los avisos del cronometro.
-- Hasta ahora los avisos se sintetizaban con Web Speech API (voz del sistema).
-- Esto permite subir audios propios ("personajes") y elegir el pack por
-- marcador. Cada clip tiene una CLAVE que dice cuando suena:
--   h<seg>  hito de aviso        (h180 = "faltan tres minutos")
--   c<n>    cuenta regresiva     (c10 = "diez")
--   inicio  al arrancar el reloj
--   fin     al llegar a cero (reemplaza la bocina si existe)
-- Si falta un clip, el visor cae a la voz sintetizada: se puede subir de a
-- pocos sin romper nada.

-- Bucket PUBLICO: el visor lo abre gente sin sesion (proyeccion, TV).
insert into storage.buckets (id, name, public)
values ('voces', 'voces', true)
on conflict (id) do nothing;

drop policy if exists "voces_read"         on storage.objects;
drop policy if exists "voces_admin_write"  on storage.objects;
drop policy if exists "voces_admin_update" on storage.objects;
drop policy if exists "voces_admin_delete" on storage.objects;

create policy "voces_read" on storage.objects
  for select to public using (bucket_id = 'voces');
create policy "voces_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'voces' and public.es_admin());
create policy "voces_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'voces' and public.es_admin())
  with check (bucket_id = 'voces' and public.es_admin());
create policy "voces_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'voces' and public.es_admin());

create table if not exists public.voces_paquetes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.voces_clips (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.voces_paquetes(id) on delete cascade,
  clave text not null,
  path text not null,               -- ruta dentro del bucket 'voces'
  created_at timestamptz not null default now(),
  unique (paquete_id, clave)
);

create index if not exists voces_clips_paquete_idx on public.voces_clips(paquete_id);

alter table public.voces_paquetes enable row level security;
alter table public.voces_clips    enable row level security;

-- Lectura publica: el visor (sin sesion) necesita resolver los clips.
drop policy if exists "voces_paquetes_read" on public.voces_paquetes;
create policy "voces_paquetes_read" on public.voces_paquetes
  for select to anon, authenticated using (true);
drop policy if exists "voces_paquetes_admin" on public.voces_paquetes;
create policy "voces_paquetes_admin" on public.voces_paquetes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "voces_clips_read" on public.voces_clips;
create policy "voces_clips_read" on public.voces_clips
  for select to anon, authenticated using (true);
drop policy if exists "voces_clips_admin" on public.voces_clips;
create policy "voces_clips_admin" on public.voces_clips
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select on public.voces_paquetes, public.voces_clips to anon, authenticated;
grant insert, update, delete on public.voces_paquetes, public.voces_clips to authenticated;

-- Pack elegido por marcador (null = voz sintetizada del sistema).
alter table public.marcadores
  add column if not exists voz_paquete_id uuid
    references public.voces_paquetes(id) on delete set null;
