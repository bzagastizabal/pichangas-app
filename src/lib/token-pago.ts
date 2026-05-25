// Token de pago FIRMADO (JWS/HMAC-SHA256), sin guardar nada en la BD.
// El enlace lleva el inscripcion_id + una firma; el servidor la verifica.
// SOLO servidor: usa un secreto del entorno.
import crypto from 'crypto';

function secreto(): string {
  const s = process.env.PAGO_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Falta PAGO_LINK_SECRET / SUPABASE_SERVICE_ROLE_KEY.');
  return s;
}

function firma(payload: string): string {
  return crypto.createHmac('sha256', secreto()).update(payload).digest('base64url');
}

export function firmarTokenPago(inscripcionId: string): string {
  const payload = Buffer.from(JSON.stringify({ iid: inscripcionId })).toString('base64url');
  return `${payload}.${firma(payload)}`;
}

export function verificarTokenPago(token: string): string | null {
  const [payload, sig] = (token ?? '').split('.');
  if (!payload || !sig) return null;

  const esperado = firma(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof data?.iid === 'string' ? data.iid : null;
  } catch {
    return null;
  }
}
