// Endpoint de recordatorios. Lo llama pg_cron (vía pg_net) cada hora con
// ?horas=3 para avisar a los inscritos de eventos próximos (ventana ajustable).
// Marca el evento para no repetir. Protegido con CRON_SECRET (header Authorization).
import { createAdminClient } from '@/lib/supabase/admin';
import { enviarEmail, correoHtml } from '@/lib/email';
import { linkGoogleCalendar } from '@/lib/calendario';
import { formatearFechaLima } from '@/lib/fechas';

type EvFila = {
  id: string;
  fecha_hora_evento: string;
  duracion_horas: number;
  sedes: { nombre: string; direccion: string | null } | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const admin = createAdminClient();
  const ahora = new Date();
  const horas = Number(new URL(request.url).searchParams.get('horas')) || 24;
  const limite = new Date(ahora.getTime() + horas * 3600 * 1000);

  const { data: evData } = await admin
    .from('eventos')
    .select('id, fecha_hora_evento, duracion_horas, sedes(nombre, direccion)')
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

    const sede = ev.sedes?.nombre ?? 'la cancha';
    const cal = linkGoogleCalendar({
      titulo: `Pichanga · ${sede}`,
      inicioISO: ev.fecha_hora_evento,
      duracionHoras: ev.duracion_horas,
      ubicacion: ev.sedes?.direccion ?? sede,
    });
    for (const ins of (inscs as { usuario_id: string; estado: string }[]) ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(ins.usuario_id);
      const ok = await enviarEmail({
        to: u?.user?.email,
        subject: 'Recordatorio: tu pichanga 🏀',
        html: correoHtml('¡Tu pichanga se acerca!', [
          `Te esperamos en <strong>${sede}</strong> el ${formatearFechaLima(ev.fecha_hora_evento)}.`,
          ins.estado === 'pendiente'
            ? 'Aún tienes el <strong>pago pendiente</strong>: no pierdas tu cupo.'
            : 'Tu cupo está confirmado. ¡Nos vemos! 🏀',
          `<a href="${cal}" style="color:#ea580c">📅 Agregar a Google Calendar</a>`,
        ]),
      });
      if (ok) enviados++;
    }

    await admin.from('eventos').update({ recordatorio_enviado: true }).eq('id', ev.id);
  }

  return Response.json({ eventos: eventos.length, enviados });
}
