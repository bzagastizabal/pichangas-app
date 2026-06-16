'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EstadoForm, MetodoPago } from '@/lib/types';

const METODOS_PAGO: MetodoPago[] = ['yape', 'plin', 'banco', 'efectivo'];

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
  if (!METODOS_PAGO.includes(metodo as MetodoPago)) return { error: 'Método inválido.' };
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

// Admin aprueba un pago SIN captura (caso típico: pago en efectivo o pago ya
// verificado por otra vía). Inserta un pago con url_comprobante = NULL y
// llama a la RPC aprobar_pago para que se confirme la inscripción y se
// dispare la lógica de desplazamientos / notificaciones igual que con un
// pago normal.
export async function aprobarPagoManual(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const inscripcionId = formData.get('inscripcion_id') as string;
  const metodo = formData.get('metodo') as string;
  const monto = Number(formData.get('monto_declarado'));

  if (!inscripcionId) return { error: 'Falta la inscripción.' };
  if (!METODOS_PAGO.includes(metodo as MetodoPago)) return { error: 'Método inválido.' };
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'Monto inválido.' };

  const admin = createAdminClient();
  const { data: pago, error: errInsert } = await admin
    .from('pagos')
    .insert({
      inscripcion_id: inscripcionId,
      url_comprobante: null,
      metodo,
      monto_declarado: monto,
    })
    .select('id')
    .single();
  if (errInsert || !pago) {
    return { error: 'No se pudo registrar el pago: ' + (errInsert?.message ?? '') };
  }

  const { error: errRpc } = await admin.rpc('aprobar_pago', { p_pago_id: pago.id });
  if (errRpc) return { error: 'No se pudo aprobar: ' + errRpc.message };

  refresh();
  return {};
}
