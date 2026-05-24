-- supabase/sql/06_notificaciones.sql
-- Fase 3 — Notificaciones in-app (base para email/WhatsApp más adelante).
-- Córrelo en Supabase: Dashboard -> SQL Editor -> pega y RUN.
--
-- Las funciones de cupos (07) escriben aquí cuando alguien es promovido,
-- liberado, expirado o confirmado. El usuario ve y marca como leídas las suyas.

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  evento_id uuid references public.eventos(id) on delete set null,
  tipo text not null,                       -- promovido | liberado | expirado | confirmado
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_usuario
  on public.notificaciones (usuario_id, leida, created_at desc);

alter table public.notificaciones enable row level security;

-- El dueño ve las suyas.
drop policy if exists "notif_ver_propias" on public.notificaciones;
create policy "notif_ver_propias" on public.notificaciones
  for select to authenticated using (usuario_id = auth.uid());

-- El dueño puede marcarlas como leídas.
drop policy if exists "notif_actualizar_propias" on public.notificaciones;
create policy "notif_actualizar_propias" on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- El admin ve todas.
drop policy if exists "notif_admin_ve_todo" on public.notificaciones;
create policy "notif_admin_ve_todo" on public.notificaciones
  for select to authenticated using (public.es_admin());

-- No hay política de INSERT: solo las funciones SECURITY DEFINER (07) insertan.
grant select, update on public.notificaciones to authenticated;
