// Cron diario (Vercel): envía recordatorios por correo de los eventos que se
// juegan en las próximas ~24 h y marca el evento para no repetir.
// Protegido con CRON_SECRET (Vercel lo manda como Authorization: Bearer ...).
import { createAdminClient } from '@/lib/supabase/admin';
import { enviarEmail, correoHtml } from '@/lib/email';
import { formatearFechaLima } from '@/lib/fechas';

type EvFila = { id: string; fecha_hora_evento: string; sedes: { nombre: string } | null };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const admin = createAdminClient();
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 24 * 3600 * 1000);

  const { data: evData } = await admin
    .from('eventos')
    .select('id, fecha_hora_evento, sedes(nombre)')
    .eq('estado', 'abierta')
    .eq('recordatorio_enviado', false)
    .gte('fecha_hora_evento', ahora.toISOString())
    .lte('fecha_hora_evento', limite.toISOString());
  const eventos = (evData as unknown as EvFila[]) ?? [];

  let enviados = 0;
  for (const ev of eventos) {
    const { data: inscs } = await admin
      .from('inscripciones')
      .select('usuario_id, estado')
      .eq('evento_id', ev.id)
      .in('estado', ['pendiente', 'confirmado']);

    for (const ins of (inscs as { usuario_id: string; estado: string }[]) ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(ins.usuario_id);
      const sede = ev.sedes?.nombre ?? 'la cancha';
      const ok = await enviarEmail({
        to: u?.user?.email,
        subject: 'Recordatorio: tu pichanga 🏀',
        html: correoHtml('¡Tu pichanga se acerca!', [
          `Te esperamos en <strong>${sede}</strong> el ${formatearFechaLima(ev.fecha_hora_evento)}.`,
          ins.estado === 'pendiente'
            ? 'Aún tienes el <strong>pago pendiente</strong>: no pierdas tu cupo.'
            : 'Tu cupo está confirmado. ¡Nos vemos! 🏀',
        ]),
      });
      if (ok) enviados++;
    }

    await admin.from('eventos').update({ recordatorio_enviado: true }).eq('id', ev.id);
  }

  return Response.json({ eventos: eventos.length, enviados });
}
