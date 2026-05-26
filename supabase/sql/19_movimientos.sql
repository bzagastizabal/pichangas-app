-- Fase 7 — Movimientos financieros independientes a los eventos.
-- Ingresos: donaciones, premios, aportes, saldos a favor de pichangas, etc.
-- Egresos: compras, gastos, pagos, reembolsos, etc.
-- Cada movimiento exige un sustento (archivo) y la aprobación de un admin.

-- Enums
do $$ begin
  create type public.tipo_movimiento as enum ('ingreso','egreso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.categoria_movimiento as enum (
    -- ingresos
    'donacion','premio','aporte','saldo_pichanga',
    -- egresos
    'compra','gasto','pago','reembolso',
    -- comodín ambos lados
    'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_movimiento as enum ('pendiente','aprobado','rechazado');
exception when duplicate_object then null; end $$;

-- Tabla
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_movimiento not null,
  categoria public.categoria_movimiento not null,
  monto numeric not null check (monto > 0),
  descripcion text not null,
  fecha date not null default current_date,
  evento_id uuid references public.eventos(id) on delete set null, -- opcional
  url_sustento text not null,
  estado public.estado_movimiento not null default 'pendiente',
  creado_por uuid not null references public.perfiles(id) on delete restrict,
  aprobado_por uuid references public.perfiles(id) on delete set null,
  fecha_aprobado timestamptz,
  motivo_rechazo text,
  created_at timestamptz not null default now()
);

alter table public.movimientos enable row level security;

-- Solo admins manejan este módulo (creación, lectura, aprobación, borrado).
drop policy if exists "mov_admin_all" on public.movimientos;
create policy "mov_admin_all" on public.movimientos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select, insert, update, delete on public.movimientos to authenticated;

create index if not exists movimientos_estado_idx on public.movimientos(estado);
create index if not exists movimientos_fecha_idx  on public.movimientos(fecha);
create index if not exists movimientos_tipo_idx   on public.movimientos(tipo);

-- RPC aprobar
create or replace function public.aprobar_movimiento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  update public.movimientos
    set estado = 'aprobado',
        aprobado_por = auth.uid(),
        fecha_aprobado = now(),
        motivo_rechazo = null
    where id = p_id and estado = 'pendiente';
end; $$;

grant execute on function public.aprobar_movimiento(uuid) to authenticated;

-- RPC rechazar
create or replace function public.rechazar_movimiento(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  update public.movimientos
    set estado = 'rechazado',
        aprobado_por = auth.uid(),
        fecha_aprobado = now(),
        motivo_rechazo = nullif(trim(p_motivo), '')
    where id = p_id and estado = 'pendiente';
end; $$;

grant execute on function public.rechazar_movimiento(uuid, text) to authenticated;

-- Storage bucket privado para los sustentos.
insert into storage.buckets (id, name, public)
values ('sustentos','sustentos', false)
on conflict (id) do nothing;

-- Storage RLS: solo admins leen/escriben.
drop policy if exists "sustentos_admin_read"   on storage.objects;
drop policy if exists "sustentos_admin_write"  on storage.objects;
drop policy if exists "sustentos_admin_update" on storage.objects;
drop policy if exists "sustentos_admin_delete" on storage.objects;

create policy "sustentos_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'sustentos' and public.es_admin());

create policy "sustentos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sustentos' and public.es_admin());

create policy "sustentos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'sustentos' and public.es_admin())
  with check (bucket_id = 'sustentos' and public.es_admin());

create policy "sustentos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sustentos' and public.es_admin());
