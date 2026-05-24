-- supabase/sql/03_precios_por_hora.sql
-- Fase 2 — Precios por hora y duración del evento.
-- Córrelo en Supabase: Dashboard -> SQL Editor -> pega y RUN.
--
-- Modelo:
--   sedes.precio_por_hora     = cuánto cuesta la cancha por hora.
--   arbitros.precio_por_hora  = cuánto cobra el árbitro por hora.
--   eventos.duracion_horas    = duración del partido (rangos de media hora: 1, 1.5, 2…).
-- Al crear un evento, costo_sede y costo_arbitraje se proponen como
--   precio_por_hora * duracion_horas, pero el admin puede ajustarlos
--   (costo especial puntual en esa sede, etc.).

alter table public.sedes
  add column if not exists precio_por_hora numeric not null default 0;

alter table public.arbitros
  add column if not exists precio_por_hora numeric not null default 0;

alter table public.eventos
  add column if not exists duracion_horas numeric not null default 1.5;

-- Coherencia: la duración debe ser positiva y en pasos de media hora.
alter table public.eventos
  drop constraint if exists eventos_duracion_media_hora;
alter table public.eventos
  add constraint eventos_duracion_media_hora
  check (duracion_horas > 0 and (duracion_horas * 2) = floor(duracion_horas * 2));
