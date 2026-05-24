-- Fase 5B — Link de pago asociado a una inscripción.
-- El token va en la inscripción; la página /pagar/[token] y la subida del voucher
-- se resuelven en el servidor con service-role (el token es el secreto de acceso).
alter table public.inscripciones
  add column if not exists token_pago text unique;
