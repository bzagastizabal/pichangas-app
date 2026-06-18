'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EstadoForm, MetodoPago } from '@/lib/types';

const METODOS_PAGO: MetodoPago[] = ['yape', 'plin', 'banco', 'efectivo'];

// Inscribe un jugador. Si hay cupo lo agrega como 'confirmado' (juega; el pago
// se rastrea aparte y, si no paga, sale como moroso). Si los cupos están llenos
// (pendiente + confirmado >= cupos_totales) entra como 'lista_espera' con su
// posición — aparece como suplente en el mensaje de WhatsApp. Idempotente.
export async function agregarParticipante(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventoId = formData.get('evento_id') as string;
  const usuarioId = formData.get('usuario_id') as string;
  if (!eventoId || !usuarioId) return;

  const admin = createAdminClient();

  // No duplicamos si ya tiene inscripción viva.
  const { data: existente } = await admin
    .from('inscripciones')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('usuario_id', usuarioId)
    .in('estado', ['pendiente', 'confirmado', 'lista_espera'])
    .maybeSingle();
  if (existente) {
    refresh();
    return;
  }

  // ¿Hay cupo? (ocupan cupo solo pendiente + confirmado, no lista_espera).
  const { data: evento } = await admin
    .from('eventos')
    .select('cupos_totales')
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) {
    refresh();
    return;
  }
  const { count: ocupados } = await admin
    .from('inscripciones')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', eventoId)
    .in('estado', ['pendiente', 'confirmado']);
  const hayCupo = (ocupados ?? 0) < evento.cupos_totales;

  // Posición de lista de espera: max actual + 1 (deja la cola ordenada para
  // que aparezcan en orden de llegada en el mensaje de WhatsApp).
  let posicion_lista: number | null = null;
  if (!hayCupo) {
    const { data: ult } = await admin
      .from('inscripciones')
      .select('posicion_lista')
      .eq('evento_id', eventoId)
      .eq('estado', 'lista_espera')
      .order('posicion_lista', { ascending: false, nullsFirst: false })
      .limit(1);
    const max =
      (ult as { posicion_lista: number | null }[] | null)?.[0]?.posicion_lista ?? 0;
    posicion_lista = max + 1;
  }

  await admin.from('inscripciones').insert({
    evento_id: eventoId,
    usuario_id: usuarioId,
    estado: hayCupo ? 'confirmado' : 'lista_espera',
    posicion_lista,
  });
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

  // INSERT con service-role (bypassa RLS, asegurando que entre el pago).
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

  // El RPC chequea es_admin() leyendo auth.uid(); por eso va con el cliente
  // ligado a la sesion del admin (no con service-role que tiene uid null).
  const supabase = await createClient();
  const { error: errRpc } = await supabase.rpc('aprobar_pago', { p_pago_id: pago.id });
  if (errRpc) {
    // Limpia el pago huerfano si la RPC falla, sino queda en en_revision sin avisar.
    await admin.from('pagos').delete().eq('id', pago.id);
    return { error: 'No se pudo aprobar: ' + errRpc.message };
  }

  refresh();
  return {};
}
