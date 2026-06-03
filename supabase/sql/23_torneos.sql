-- 23 — Torneos: control de participación del club + integración con movimientos.
--   torneos: convocatorias del club a torneos externos.
--   torneo_jugadores: roster (qué jugadores el club lleva).
--   torneo_partidos: cada fecha del torneo.
--   partido_jugadores: asistencia por partido (quién jugó / quién no).
--   movimientos gana torneo_id / partido_id para gastos de inscripción,
--   gastos por partido, aportes e ingresos vinculados al torneo.

do $$ begin
  create type public.estado_torneo as enum (
    'convocados','inscritos','en_curso','finalizado','cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_partido as enum (
    'programado','jugado','wo','aplazado','cancelado'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- Torneos
-- ============================================================
create table if not exists public.torneos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  organizador text,
  categoria_id uuid references public.categorias(id) on delete set null,
  fecha_inicio date,
  fecha_fin date,
  ubicacion text,
  estado public.estado_torneo not null default 'convocados',
  posicion_final text,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.torneos enable row level security;
drop policy if exists "torneos_admin" on public.torneos;
create policy "torneos_admin" on public.torneos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.torneos to authenticated;

create index if not exists torneos_estado_idx on public.torneos(estado);
create index if not exists torneos_categoria_idx on public.torneos(categoria_id);

-- ============================================================
-- Roster del torneo
-- ============================================================
create table if not exists public.torneo_jugadores (
  torneo_id uuid not null references public.torneos(id) on delete cascade,
  jugador_id uuid not null references public.perfiles(id) on delete cascade,
  numero_camiseta int,
  es_capitan boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (torneo_id, jugador_id)
);

alter table public.torneo_jugadores enable row level security;
drop policy if exists "torneo_jug_admin" on public.torneo_jugadores;
create policy "torneo_jug_admin" on public.torneo_jugadores
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.torneo_jugadores to authenticated;

create index if not exists torneo_jugadores_jugador_idx on public.torneo_jugadores(jugador_id);

-- ============================================================
-- Partidos del torneo
-- ============================================================
create table if not exists public.torneo_partidos (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.torneos(id) on delete cascade,
  fecha timestamptz not null,
  rival text not null,
  ubicacion text,
  puntos_propio int,
  puntos_rival int,
  estado public.estado_partido not null default 'programado',
  notas text,
  created_at timestamptz not null default now()
);

alter table public.torneo_partidos enable row level security;
drop policy if exists "torneo_part_admin" on public.torneo_partidos;
create policy "torneo_part_admin" on public.torneo_partidos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.torneo_partidos to authenticated;

create index if not exists torneo_partidos_torneo_idx on public.torneo_partidos(torneo_id);
create index if not exists torneo_partidos_fecha_idx on public.torneo_partidos(fecha);

-- ============================================================
-- Asistencia por partido
-- ============================================================
create table if not exists public.partido_jugadores (
  partido_id uuid not null references public.torneo_partidos(id) on delete cascade,
  jugador_id uuid not null references public.perfiles(id) on delete cascade,
  jugo boolean not null default true,
  minutos int,
  puntos int,
  notas text,
  created_at timestamptz not null default now(),
  primary key (partido_id, jugador_id)
);

alter table public.partido_jugadores enable row level security;
drop policy if exists "part_jug_admin" on public.partido_jugadores;
create policy "part_jug_admin" on public.partido_jugadores
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.partido_jugadores to authenticated;

-- ============================================================
-- Movimientos: vincular a torneo / partido (mantiene compat con evento_id).
-- ============================================================
alter table public.movimientos
  add column if not exists torneo_id uuid references public.torneos(id) on delete set null,
  add column if not exists partido_id uuid references public.torneo_partidos(id) on delete set null;

create index if not exists movimientos_torneo_idx on public.movimientos(torneo_id);
create index if not exists movimientos_partido_idx on public.movimientos(partido_id);
