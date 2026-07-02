-- SQL 32 — titulo opcional del marcador (evento/torneo/partido).
-- Se muestra en la parte superior del visor cuando esta seteado.

alter table public.marcadores
  add column if not exists titulo text;
