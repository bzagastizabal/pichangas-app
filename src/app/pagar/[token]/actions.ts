'use server';

import { refresh } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { verificarTokenPago } from '@/lib/token-pago';
import type { EstadoForm } from '@/lib/types';

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

// Subida pública del voucher: el token de la inscripción es el secreto de acceso.
// Sin login; el servidor opera solo sobre la inscripción de ese token (service-role).
export async function subirVoucherPorToken(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const token = formData.get('token') as string;
  const metodo = formData.get('metodo') as string;
  const monto = Number(formData.get('monto_declarado'));
  const archivo = formData.get('comprobante') as File | null;

  if (!token) return { error: 'Link inválido.' };
  if (!['yape', 'plin', 'banco'].includes(metodo)) return { error: 'Elige un método.' };
  if (Number.isNaN(monto) || monto <= 0) return { error: 'Ingresa el monto.' };
  if (!archivo || archivo.size === 0) return { error: 'Adjunta tu comprobante.' };
  if (!MIMES_OK.includes(archivo.type)) return { error: 'Imagen o PDF.' };
  if (archivo.size > MAX_BYTES) return { error: 'Máximo 5 MB.' };

  const iid = verificarTokenPago(token);
  if (!iid) return { error: 'Link inválido.' };

  const admin = createAdminClient();
  const { data: insc } = await admin
    .from('inscripciones')
    .select('id, usuario_id, pagos(estado)')
    .eq('id', iid)
    .maybeSingle();
  if (!insc) return { error: 'Link inválido o vencido.' };

  const pagos = (insc.pagos as { estado: string }[]) ?? [];
  if (pagos.some((p) => p.estado === 'aprobado')) {
    return { error: 'Tu pago ya fue registrado.' };
  }

  const ext = archivo.name.includes('.') ? archivo.name.split('.').pop() : 'jpg';
  const ruta = `${insc.usuario_id}/${insc.id}-${Date.now()}.${ext}`;

  const { error: errSubida } = await admin.storage
    .from('comprobantes')
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errSubida) return { error: 'No se pudo subir: ' + errSubida.message };

  const { error: errPago } = await admin.from('pagos').insert({
    inscripcion_id: insc.id,
    url_comprobante: ruta,
    metodo,
    monto_declarado: monto,
  });
  if (errPago) {
    await admin.storage.from('comprobantes').remove([ruta]);
    return { error: 'No se pudo registrar: ' + errPago.message };
  }

  refresh();
  return {};
}
