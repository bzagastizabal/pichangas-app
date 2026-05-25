// Envío de correos vía Resend (API HTTP, sin SDK). SOLO servidor.
// No envía a correos sintéticos de jugadores creados por admin (@jugador.cmt).
const SINTETICO = /@jugador\.cmt$/i;

export async function enviarEmail(opts: {
  to: string | null | undefined;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_APIKEY || process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Pichangas CMT <onboarding@resend.dev>';
  const to = (opts.to || '').trim();
  if (!key || !to || SINTETICO.test(to)) return false;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Plantilla simple con estilos inline (para clientes de correo).
export function correoHtml(
  titulo: string,
  parrafos: string[],
  boton?: { texto: string; url: string },
): string {
  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 12px;color:#333;font-size:15px;line-height:1.5">${p}</p>`)
    .join('');
  const btn = boton
    ? `<a href="${boton.url}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:15px">${boton.texto}</a>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#111;margin:0 0 16px">🏀 ${titulo}</h1>
    ${cuerpo}${btn}
    <p style="margin-top:24px;color:#999;font-size:12px">Pichangas CMT</p>
  </div>`;
}
