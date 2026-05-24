-- Fase 5E — Categorías por jugador (N a N) para precargar participantes por categoría.
create table if not exists public.perfil_categorias (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  primary key (perfil_id, categoria_id)
);

alter table public.perfil_categorias enable row level security;

drop policy if exists "pc_admin" on public.perfil_categorias;
create policy "pc_admin" on public.perfil_categorias
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "pc_ver_propias" on public.perfil_categorias;
create policy "pc_ver_propias" on public.perfil_categorias
  for select to authenticated
  using (perfil_id = auth.uid());

grant select, insert, update, delete on public.perfil_categorias to authenticated;
