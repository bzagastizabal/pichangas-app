// src/app/admin/torneos/actions.ts
// CRUD básico de torneos.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { EstadoForm, EstadoTorneo } from '@/lib/types';

const ESTADOS: EstadoTorneo[] = [
  'convocados',
  'inscritos',
  'en_curso',
  'finalizado',
  'cancelado',
];

function txt(v: FormDataEntryValue | null): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  return s === '' ? null : s;
}

function leerCampos(formData: FormData) {
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? '';
  if (!nombre) return { ok: false as const, error: 'El nombre es obligatorio.' };

  const estadoRaw = (formData.get('estado') as string | null)?.trim() ?? 'convocados';
  const estado: EstadoTorneo = ESTADOS.includes(estadoRaw as EstadoTorneo)
    ? (estadoRaw as EstadoTorneo)
    : 'convocados';

  return {
    ok: true as const,
    campos: {
      nombre,
      organizador: txt(formData.get('organizador')),
      categoria_id: txt(formData.get('categoria_id')),
      fecha_inicio: txt(formData.get('fecha_inicio')),
      fecha_fin: txt(formData.get('fecha_fin')),
      ubicacion: txt(formData.get('ubicacion')),
      posicion_final: txt(formData.get('posicion_final')),
      notas: txt(formData.get('notas')),
      estado,
    },
  };
}

export async function crearTorneo(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('torneos')
    .insert(r.campos)
    .select('id')
    .single();
  if (error || !data) return { error: 'No se pudo crear: ' + (error?.message ?? '') };

  redirect(`/admin/torneos/${data.id}`);
}

export async function actualizarTorneo(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { error: 'Falta el identificador del torneo.' };
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { error } = await supabase.from('torneos').update(r.campos).eq('id', id);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect(`/admin/torneos/${id}`);
}

export async function eliminarTorneo(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('torneos').delete().eq('id', id);
  redirect('/admin/torneos');
}

export async function cambiarEstadoTorneo(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const estadoRaw = (formData.get('estado') as string | null) ?? '';
  if (!ESTADOS.includes(estadoRaw as EstadoTorneo)) return;
  const supabase = await createClient();
  await supabase.from('torneos').update({ estado: estadoRaw }).eq('id', id);
  refresh();
}
