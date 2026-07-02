-- SQL 33 — bandera "neon": halo brillante alrededor del puntaje.
-- Recomendado para proyectores de bajos lumenes (el halo aumenta el area
-- luminosa visible sin perder contraste).

alter table public.marcadores
  add column if not exists neon boolean not null default false;
