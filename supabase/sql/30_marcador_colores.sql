-- SQL 30 — color de texto por equipo (opcional, default blanco).
-- Se aplica al nombre del equipo en el visor; el "punto" y el glow del
-- puntaje siguen usando los colores de lado (naranja/sky) para identidad.

alter table public.marcadores
  add column if not exists color_local     text not null default '#ffffff',
  add column if not exists color_visitante text not null default '#ffffff';

-- Validación blanda de formato HEX (#rgb / #rrggbb). Permite igualar el
-- comportamiento si alguien inserta por SQL directo.
alter table public.marcadores
  drop constraint if exists marcadores_color_local_chk;
alter table public.marcadores
  drop constraint if exists marcadores_color_visitante_chk;
alter table public.marcadores
  add constraint marcadores_color_local_chk
    check (color_local ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$');
alter table public.marcadores
  add constraint marcadores_color_visitante_chk
    check (color_visitante ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$');
