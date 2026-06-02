-- 21 — Marcador de baloncesto (utilitario, no se asocia a eventos).
-- El estado vive aquí (SSOT); el reloj se calcula client-side con
-- reloj_inicio (timestamptz) + reloj_restante_ms para evitar drift.
-- RLS: lectura pública por slug (cualquiera ve la pantalla); escritura
-- solo administradores.

create table if not exists public.marcadores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,

  nombre_local text not null default 'LOCAL',
  nombre_visitante text not null default 'VISITANTE',

  puntos_local int not null default 0 check (puntos_local >= 0),
  puntos_visitante int not null default 0 check (puntos_visitante >= 0),

  faltas_local int not null default 0 check (faltas_local >= 0),
  faltas_visitante int not null default 0 check (faltas_visitante >= 0),

  timeouts_local int not null default 2 check (timeouts_local >= 0),
  timeouts_visitante int not null default 2 check (timeouts_visitante >= 0),

  periodo int not null default 1 check (periodo >= 1),
  duracion_periodo_seg int not null default 600 check (duracion_periodo_seg > 0), -- 10 min

  -- Reloj principal: ms restantes desde la última actualización + marca de
  -- inicio si está corriendo. El cliente calcula:
  --   restante_actual = corriendo
  --     ? max(0, reloj_restante_ms - (now() - reloj_inicio))
  --     : reloj_restante_ms
  reloj_restante_ms int not null default 600000,
  reloj_corriendo boolean not null default false,
  reloj_inicio timestamptz,

  -- Shot clock
  shot_duracion_ms int not null default 24000,
  shot_restante_ms int not null default 24000,
  shot_corriendo boolean not null default false,
  shot_inicio timestamptz,

  -- Expiración (links expirables) y autor
  expira_en timestamptz not null default (now() + interval '24 hours'),
  creado_por uuid not null references public.perfiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.marcadores enable row level security;

drop policy if exists "marcadores_read" on public.marcadores;
create policy "marcadores_read" on public.marcadores
  for select to anon, authenticated using (true);

drop policy if exists "marcadores_admin" on public.marcadores;
create policy "marcadores_admin" on public.marcadores
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.marcadores to anon, authenticated;
grant insert, update, delete on public.marcadores to authenticated;

create index if not exists marcadores_slug_idx on public.marcadores(slug);
create index if not exists marcadores_expira_idx on public.marcadores(expira_en);

-- Habilita Realtime para la tabla (UPDATEs se broadcastean por websocket).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marcadores'
  ) then
    alter publication supabase_realtime add table public.marcadores;
  end if;
end $$;
