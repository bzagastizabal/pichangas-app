-- 29 — Hace opcional el periodo (Q) del marcador. Combinado con tiene_reloj_periodo
-- y tiene_shot_clock permite modo "solo nombres + puntajes" maximo.
alter table public.marcadores
  add column if not exists tiene_periodo boolean not null default true;
