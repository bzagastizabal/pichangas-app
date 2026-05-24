-- Fase 5D — Categorías (configuración independiente) y tipo de evento.
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categorias enable row level security;

drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  for select to authenticated using (true);

drop policy if exists "categorias_admin" on public.categorias;
create policy "categorias_admin" on public.categorias
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

grant select, insert, update, delete on public.categorias to authenticated;

alter table public.eventos
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

alter table public.eventos
  add column if not exists tipo text not null default 'pichanga'
  check (tipo in ('pichanga', 'amistoso', 'torneo'));

-- Semilla opcional de categorías comunes.
insert into public.categorias (nombre)
select x from (values ('LIBRE'), ('M40'), ('M50'), ('Damas')) as v(x)
where not exists (select 1 from public.categorias);
