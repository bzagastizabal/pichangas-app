-- Fase 6 — Tarifa de árbitro por tramos de horas + varios árbitros por evento.

-- Tramos de tarifa por árbitro (≤1h, ≤2h, ≤3h, >3h).
alter table public.arbitros add column if not exists tarifa_1h numeric not null default 0;
alter table public.arbitros add column if not exists tarifa_2h numeric not null default 0;
alter table public.arbitros add column if not exists tarifa_3h numeric not null default 0;
alter table public.arbitros add column if not exists tarifa_mas numeric not null default 0;

-- Relación N-a-N evento <-> árbitros (para cotizar el gasto del evento completo).
create table if not exists public.evento_arbitros (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  arbitro_id uuid not null references public.arbitros(id) on delete cascade,
  primary key (evento_id, arbitro_id)
);

alter table public.evento_arbitros enable row level security;

drop policy if exists "ea_select" on public.evento_arbitros;
create policy "ea_select" on public.evento_arbitros
  for select to authenticated using (true);

drop policy if exists "ea_admin" on public.evento_arbitros;
create policy "ea_admin" on public.evento_arbitros
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on public.evento_arbitros to authenticated;
