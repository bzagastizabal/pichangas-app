// src/app/admin/movimientos/actions.ts
// Server Actions del módulo de movimientos. Solo admins (requireAdmin) y la BD
// vuelve a verificar con es_admin() via RLS y RPCs SECURITY DEFINER.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  type CategoriaMovimiento,
  type EstadoForm,
  type TipoMovimiento,
} from '@/lib/types';

const BUCKET = 'sustentos';

export async function crearMovimiento(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await requireAdmin();

  const tipo = (formData.get('tipo') as string | null)?.trim();
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    return { error: 'Tipo inválido.' };
  }
  const tipoMov = tipo as TipoMovimiento;

  const categoria = (formData.get('categoria') as string | null)?.trim() as
    | CategoriaMovimiento
    | undefined;
  const permitidas =
    tipoMov === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
  if (!categoria || !permitidas.includes(categoria)) {
    return { error: 'Elige una categoría válida para el tipo.' };
  }

  const monto = Number(formData.get('monto'));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: 'El monto debe ser mayor a 0.' };
  }

  const descripcion = (formData.get('descripcion') as string | null)?.trim() ?? '';
  if (!descripcion) return { error: 'Agrega una descripción.' };

  const fecha = (formData.get('fecha') as string | null)?.trim() ?? '';
  if (!fecha) return { error: 'Falta la fecha del movimiento.' };

  const eventoRaw = (formData.get('evento_id') as string | null)?.trim() ?? '';
  const evento_id = eventoRaw === '' ? null : eventoRaw;
  const torneoRaw = (formData.get('torneo_id') as string | null)?.trim() ?? '';
  const torneo_id = torneoRaw === '' ? null : torneoRaw;
  const partidoRaw = (formData.get('partido_id') as string | null)?.trim() ?? '';
  const partido_id = partidoRaw === '' ? null : partidoRaw;

  const archivo = formData.get('sustento') as File | null;
  if (!archivo || archivo.size === 0) {
    return { error: 'Adjunta el sustento (imagen o PDF).' };
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: 'El sustento no puede pesar más de 5 MB.' };
  }

  const supabase = await createClient();

  // Subida a Storage bajo {uid}/{timestamp}-{nombre seguro}
  const ext = (archivo.name.split('.').pop() || 'bin').toLowerCase();
  const seguro = `${Date.now()}.${ext.replace(/[^a-z0-9]/g, '')}`;
  const path = `${perfil.id}/${seguro}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, archivo, {
      contentType: archivo.type || undefined,
      upsert: false,
    });
  if (upErr) {
    return { error: 'No se pudo subir el sustento: ' + upErr.message };
  }

  const { error: insErr } = await supabase.from('movimientos').insert({
    tipo: tipoMov,
    categoria,
    monto,
    descripcion,
    fecha,
    evento_id,
    torneo_id,
    partido_id,
    url_sustento: path, // guardamos el path; firmamos cuando se visualiza
    creado_por: perfil.id,
  });
  if (insErr) {
    // Si falla el insert, limpiamos el archivo para no dejar huérfanos.
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: 'No se pudo guardar: ' + insErr.message };
  }

  redirect('/admin/movimientos');
}

export async function aprobarMovimiento(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.rpc('aprobar_movimiento', { p_id: id });
  refresh();
}

export async function rechazarMovimiento(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const motivo = (formData.get('motivo') as string | null) ?? '';
  const supabase = await createClient();
  await supabase.rpc('rechazar_movimiento', { p_id: id, p_motivo: motivo });
  refresh();
}

// Genera una URL firmada (válida 5 min) al sustento. Solo admins.
export async function urlSustento(path: string): Promise<string | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function eliminarMovimiento(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  // Toma el path para borrar el archivo después.
  const { data: actual } = await supabase
    .from('movimientos')
    .select('url_sustento')
    .eq('id', id)
    .single();
  await supabase.from('movimientos').delete().eq('id', id);
  if (actual?.url_sustento) {
    await supabase.storage.from(BUCKET).remove([actual.url_sustento]);
  }
  refresh();
}
