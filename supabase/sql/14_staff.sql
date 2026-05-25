-- Fase 6 — Contactos del staff (se muestran según sesión).
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cargo text,
  whatsapp text,
  es_default boolean not null default false,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Logueados: ven todos los contactos activos.
drop policy if exists "staff_auth_select" on public.staff;
create policy "staff_auth_select" on public.staff
  for select to authenticated using (activo = true);

-- Anónimos: solo el contacto por defecto.
drop policy if exists "staff_anon_select" on public.staff;
create policy "staff_anon_select" on public.staff
  for select to anon using (activo = true and es_default = true);

-- Admin: gestiona todo (también ve inactivos).
drop policy if exists "staff_admin" on public.staff;
create policy "staff_admin" on public.staff
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

grant select on public.staff to anon, authenticated;
grant insert, update, delete on public.staff to authenticated;
