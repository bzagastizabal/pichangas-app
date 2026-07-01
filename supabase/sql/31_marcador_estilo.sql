-- SQL 31 — estilo del marcador: fuente, color de puntos por equipo y color de fondo.
-- Todo tiene default sensato para retrocompatibilidad.

alter table public.marcadores
  add column if not exists fuente text not null default 'orbitron',
  add column if not exists color_puntos_local     text not null default '#ffffff',
  add column if not exists color_puntos_visitante text not null default '#ffffff',
  add column if not exists color_fondo text not null default '#000000';

-- Fuentes válidas — sync con next/font en src/app/layout.tsx.
alter table public.marcadores drop constraint if exists marcadores_fuente_chk;
alter table public.marcadores
  add constraint marcadores_fuente_chk
    check (fuente in ('orbitron','bebas','anton','iceland','rubik_mono'));

-- Colores HEX #rgb / #rrggbb.
alter table public.marcadores drop constraint if exists marcadores_color_puntos_local_chk;
alter table public.marcadores
  add constraint marcadores_color_puntos_local_chk
    check (color_puntos_local ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$');

alter table public.marcadores drop constraint if exists marcadores_color_puntos_visitante_chk;
alter table public.marcadores
  add constraint marcadores_color_puntos_visitante_chk
    check (color_puntos_visitante ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$');

alter table public.marcadores drop constraint if exists marcadores_color_fondo_chk;
alter table public.marcadores
  add constraint marcadores_color_fondo_chk
    check (color_fondo ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$');
