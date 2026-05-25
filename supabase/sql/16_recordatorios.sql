-- Fase 6 — Marca para no repetir el recordatorio por correo de un evento.
alter table public.eventos
  add column if not exists recordatorio_enviado boolean not null default false;
