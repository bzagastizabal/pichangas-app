-- Fase 5C — Egresos: pagos del organizador a sedes y árbitros.
create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos(id) on delete cascade,
  tipo text not null check (tipo in ('sede', 'arbitro', 'otro')),
  sede_id uuid references public.sedes(id) on delete set null,
  arbitro_id uuid references public.arbitros(id) on delete set null,
  monto numeric not null default 0,
  metodo text check (metodo in ('yape', 'plin', 'banco', 'efectivo')),
  fecha_pago timestamptz not null default now(),
  nota text,
  registrado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_egresos_evento on public.egresos (evento_id);

alter table public.egresos enable row level security;

drop policy if exists "egresos_admin" on public.egresos;
create policy "egresos_admin" on public.egresos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

grant select, insert, update, delete on public.egresos to authenticated;
