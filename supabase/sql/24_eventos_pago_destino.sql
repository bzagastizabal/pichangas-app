-- 24 — Destino del pago (Yape/Plin) por evento.
-- En el form del evento el admin elige a quien Yapean/Plinean los jugadores,
-- usando un atajo "cargar desde staff" o tipeando otro celular. Se guardan
-- como snapshot para que los jugadores siempre vean lo que estaba al
-- inscribirse (si cambia, el admin re-edita el evento).
alter table public.eventos
  add column if not exists pago_telefono text,
  add column if not exists pago_titular text;
