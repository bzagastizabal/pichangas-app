'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EstadoForm } from '@/lib/types';

// Inscribe un jugador (lo agrega como participante 'confirmado': juega; el pago
// se rastrea aparte y, si no paga, sale como moroso). Idempotente.
export async function agregarParticipante(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventoId = formData.get('evento_id') as string;
  const usuarioId = formData.get('usuario_id') as string;
  if (!eventoId || !usuarioId) return;

  const admin = createAdminClient();
  const { data: existente } = await admin
    .from('inscripciones')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('usuario_id', usuarioId)
    .in('estado', ['pendiente', 'confirmado', 'lista_espera'])
    .maybeSingle();
  if (!existente) {
    await admin
      .from('inscripciones')
      .insert({ evento_id: eventoId, usuario_id: usuarioId, estado: 'confirmado' });
  }
  refresh();
}

// Quita a un participante del evento (borra sus pagos y la inscripción).
export async function quitarParticipante(formData: FormData): Promise<void> {
  await requireAdmin();
  const inscripcionId = formData.get('id') as string;
  if (!inscripcionId) return;
  const admin = createAdminClient();
  await admin.from('pagos').delete().eq('inscripcion_id', inscripcionId);
  await admin.from('inscripciones').delete().eq('id', inscripcionId);
  refresh();
}

// Genera (si no existe) el token del link público de pago para esa inscripción.
export async function generarLinkPago(formData: FormData): Promise<void> {
  await requireAdmin();
  const inscripcionId = formData.get('inscripcion_id') as string;
  if (!inscripcionId) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from('inscripciones')
    .select('token_pago')
    .eq('id', inscripcionId)
    .maybeSingle();
  if (!data?.token_pago) {
    await admin
      .from('inscripciones')
      .update({ token_pago: crypto.randomUUID().replace(/-/g, '') })
      .eq('id', inscripcionId);
  }
  refresh();
}

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

// El admin sube el comprobante por el jugador (service-role escribe en su carpeta).
export async function subirComprobanteAdmin(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const inscripcionId = formData.get('inscripcion_id') as string;
  const usuarioId = formData.get('usuario_id') as string;
  const metodo = formData.get('metodo') as string;
  const monto = Number(formData.get('monto_declarado'));
  const archivo = formData.get('comprobante') as File | null;

  if (!inscripcionId || !usuarioId) return { error: 'Falta la inscripción.' };
  if (!['yape', 'plin', 'banco'].includes(metodo)) return { error: 'Método inválido.' };
  if (Number.isNaN(monto) || monto <= 0) return { error: 'Monto inválido.' };
  if (!archivo || archivo.size === 0) return { error: 'Adjunta el comprobante.' };
  if (!MIMES_OK.includes(archivo.type)) return { error: 'Imagen (jpg/png/webp) o PDF.' };
  if (archivo.size > MAX_BYTES) return { error: 'Máximo 5 MB.' };

  const admin = createAdminClient();
  const ext = archivo.name.includes('.') ? archivo.name.split('.').pop() : 'jpg';
  const ruta = `${usuarioId}/${inscripcionId}-${Date.now()}.${ext}`;

  const { error: errSubida } = await admin.storage
    .from('comprobantes')
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errSubida) return { error: 'No se pudo subir: ' + errSubida.message };

  const { error: errPago } = await admin.from('pagos').insert({
    inscripcion_id: inscripcionId,
    url_comprobante: ruta,
    metodo,
    monto_declarado: monto,
  });
  if (errPago) {
    await admin.storage.from('comprobantes').remove([ruta]);
    return { error: 'No se pudo registrar el pago: ' + errPago.message };
  }

  refresh();
  return {};
}
