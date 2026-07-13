-- SQL 35 — modo cronometro para el marcador.
-- Cuando es_cronometro=true, el visor muestra solo un reloj gigante centrado
-- (sin equipos, sin puntajes) y anuncia por voz los hitos (3/2/1 min, 30s,
-- y cuenta detallada 10..1). Reutiliza duracion_periodo_seg como total y
-- reloj_restante_ms/reloj_corriendo/reloj_inicio para el estado (SSOT).

alter table public.marcadores
  add column if not exists es_cronometro boolean not null default false;
