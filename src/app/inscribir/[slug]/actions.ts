// src/app/inscribir/[slug]/actions.ts
// Server Action de inscripción. Delega la lógica de cupos en la RPC atómica
// public.inscribirse() (SELECT ... FOR UPDATE en Postgres).
'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSesion } from '@/lib/auth';
import { baseUrl } from '@/lib/url';
import { firmarTokenPago } from '@/lib/token-pago';
import { enviarEmail, correoHtml } from '@/lib/email';
import { linkGoogleCalendar } from '@/lib/calendario';
import { formatearFechaLima } from '@/lib/fechas';
import type { EstadoForm } from '@/lib/types';

type EvCorreo = {
  costo_por_participante: number;
  fecha_hora_evento: string;
  duracion_horas: number;
  sedes: { nombre: string; direccion: string | null } | null;
};

export async function inscribirse(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const { user } = await getSesion();
  if (!user) return { error: 'Debes iniciar sesión para inscribirte.' };

  const eventoId = formData.get('evento_id') as string;
  if (!eventoId) return { error: 'Falta el evento.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('inscribirse', { p_evento_id: eventoId });
  if (error) {
    // La RPC lanza mensajes en español; los mostramos tal cual.
    return { error: error.message };
  }

  // Correo de confirmación (best-effort, no bloquea).
  try {
    const insc = data as { id: string; estado: string } | null;
    const { data: evData } = await supabase
      .from('eventos')
      .select('costo_por_participante, fecha_hora_evento, duracion_horas, sedes(nombre, direccion)')
      .eq('id', eventoId)
      .maybeSingle();
    const ev = evData as unknown as EvCorreo | null;
    if (insc && ev && user.email) {
      const link = `${await baseUrl()}/pagar/${firmarTokenPago(insc.id)}`;
      const sede = ev.sedes?.nombre ?? 'la cancha';
      const cal = linkGoogleCalendar({
        titulo: `Pichanga · ${sede}`,
        inicioISO: ev.fecha_hora_evento,
        duracionHoras: ev.duracion_horas,
        ubicacion: ev.sedes?.direccion ?? sede,
      });
      const estadoTxt =
        insc.estado === 'lista_espera'
          ? 'Quedaste en <strong>lista de espera</strong>; paga rápido para asegurar tu cupo.'
          : 'Reservaste tu cupo (<strong>pendiente de pago</strong>).';
      await enviarEmail({
        to: user.email,
        subject: 'Inscripción a la pichanga 🏀',
        html: correoHtml(
          '¡Inscripción registrada!',
          [
            `Pichanga en <strong>${sede}</strong> el ${formatearFechaLima(ev.fecha_hora_evento)}.`,
            estadoTxt,
            `Costo por jugador: S/ ${ev.costo_por_participante}.`,
            `<a href="${cal}" style="color:#ea580c">📅 Agregar a Google Calendar</a>`,
          ],
          { texto: 'Subir mi comprobante', url: link },
        ),
      });
    }
  } catch {
    // ignorar errores de correo
  }

  // Re-renderiza la página para mostrar el nuevo estado de la inscripción.
  refresh();
  return {};
}

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

export async function subirComprobante(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const { user } = await getSesion();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const inscripcionId = formData.get('inscripcion_id') as string;
  const metodo = formData.get('metodo') as string;
  const monto = Number(formData.get('monto_declarado'));
  const archivo = formData.get('comprobante') as File | null;

  if (!inscripcionId) return { error: 'Falta la inscripción.' };
  if (!['yape', 'plin', 'banco'].includes(metodo)) {
    return { error: 'Elige un método de pago válido.' };
  }
  if (Number.isNaN(monto) || monto <= 0) {
    return { error: 'Ingresa el monto que pagaste.' };
  }
  if (!archivo || archivo.size === 0) {
    return { error: 'Adjunta la captura o PDF del comprobante.' };
  }
  if (!MIMES_OK.includes(archivo.type)) {
    return { error: 'El archivo debe ser una imagen (jpg/png/webp) o PDF.' };
  }
  if (archivo.size > MAX_BYTES) {
    return { error: 'El archivo supera el límite de 5 MB.' };
  }

  const supabase = await createClient();

  // Ruta bajo la carpeta del propio usuario (lo exige la RLS de Storage).
  const ext = archivo.name.includes('.') ? archivo.name.split('.').pop() : 'jpg';
  const ruta = `${user.id}/${inscripcionId}-${Date.now()}.${ext}`;

  const { error: errSubida } = await supabase.storage
    .from('comprobantes')
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errSubida) {
    return { error: 'No se pudo subir el archivo: ' + errSubida.message };
  }

  const { error: errPago } = await supabase.from('pagos').insert({
    inscripcion_id: inscripcionId,
    url_comprobante: ruta,
    metodo,
    monto_declarado: monto,
  });
  if (errPago) {
    // Si falla el registro, quitamos el archivo huérfano.
    await supabase.storage.from('comprobantes').remove([ruta]);
    return { error: 'No se pudo registrar el pago: ' + errPago.message };
  }

  refresh();
  return {};
}
