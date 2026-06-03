-- 22 — Hace opcionales el reloj de periodo y el shot clock del marcador.
-- Por defecto ambos siguen activos (true) para no romper los marcadores
-- existentes; los nuevos pueden crearse en modo "solo contar puntos".
alter table public.marcadores
  add column if not exists tiene_reloj_periodo boolean not null default true,
  add column if not exists tiene_shot_clock boolean not null default true;
