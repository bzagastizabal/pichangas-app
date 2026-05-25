-- Fase 6 — Publicaciones (mini-blog de eventos con imágenes).
create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  evento_id uuid references public.eventos(id) on delete set null,
  imagenes text[] not null default '{}',
  autor_id uuid references public.perfiles(id),
  publicado boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_publicaciones_fecha on public.publicaciones (created_at desc);

alter table public.publicaciones enable row level security;

-- Los usuarios logueados ven las publicadas; el admin ve y gestiona todo.
drop policy if exists "pub_select" on public.publicaciones;
create policy "pub_select" on public.publicaciones
  for select to authenticated using (publicado = true);

drop policy if exists "pub_admin" on public.publicaciones;
create policy "pub_admin" on public.publicaciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on public.publicaciones to authenticated;

-- Storage: bucket 'publicaciones' es público (lectura abierta por URL pública).
-- Solo el admin sube/borra archivos.
drop policy if exists "pub_storage_admin_insert" on storage.objects;
create policy "pub_storage_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publicaciones' and public.es_admin());

drop policy if exists "pub_storage_admin_delete" on storage.objects;
create policy "pub_storage_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'publicaciones' and public.es_admin());
