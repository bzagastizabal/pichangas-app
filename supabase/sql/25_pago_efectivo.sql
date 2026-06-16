-- 25 — Permitir aprobar pagos sin captura (típicamente en efectivo).
-- Solo agrega un valor al enum metodo_pago. url_comprobante en la tabla
-- pagos ya era nullable (la imagen se borra a los 60 días por retención),
-- así que un pago en efectivo se guarda con url_comprobante = NULL y
-- estado = 'aprobado'.
--
-- Nota: ALTER TYPE ... ADD VALUE no corre dentro de un bloque transaccional,
-- por eso va como statement suelto. IF NOT EXISTS evita error si ya existe.
alter type public.metodo_pago add value if not exists 'efectivo';
