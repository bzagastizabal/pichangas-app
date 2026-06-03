// src/app/admin/marcadores/actions.ts
// Acciones del listado de marcadores (crear, eliminar, prorrogar expiración).
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { EstadoForm } from '@/lib/types';

function nuevoSlug(): string {
  // 12 chars hex (~48 bits): suficiente para que sea no-adivinable.
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function crearMarcador(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await requireAdmin();
  const nombre_local = ((formData.get('nombre_local') as string) || '').trim() || 'LOCAL';
  const nombre_visitante =
    ((formData.get('nombre_visitante') as string) || '').trim() || 'VISITANTE';
  // Los checkboxes envían 'on' cuando están marcados; si no están en el FormData
  // están desmarcados → flag = false.
  const tiene_reloj_periodo = formData.get('tiene_reloj_periodo') === 'on';
  const tiene_shot_clock = formData.get('tiene_shot_clock') === 'on';
  const minutos = Math.max(1, parseInt((formData.get('duracion_min') as string) || '10', 10));
  const shotSeg = Math.max(1, parseInt((formData.get('shot_seg') as string) || '24', 10));
  const horas = Math.max(1, parseInt((formData.get('horas_expiracion') as string) || '24', 10));

  const supabase = await createClient();
  const baseInsert = {
    slug: nuevoSlug(),
    nombre_local,
    nombre_visitante,
    duracion_periodo_seg: minutos * 60,
    reloj_restante_ms: minutos * 60 * 1000,
    shot_duracion_ms: shotSeg * 1000,
    shot_restante_ms: shotSeg * 1000,
    tiene_reloj_periodo,
    tiene_shot_clock,
    expira_en: new Date(Date.now() + horas * 3600 * 1000).toISOString(),
    creado_por: perfil.id,
  };
  let { data, error } = await supabase
    .from('marcadores')
    .insert(baseInsert)
    .select('id')
    .single();
  // Si todavía no se corrió SQL 22, repetimos sin los flags opcionales.
  if (error && /tiene_(reloj_periodo|shot_clock)/.test(error.message)) {
    const sinFlags = { ...baseInsert };
    delete (sinFlags as Record<string, unknown>).tiene_reloj_periodo;
    delete (sinFlags as Record<string, unknown>).tiene_shot_clock;
    const r = await supabase.from('marcadores').insert(sinFlags).select('id').single();
    data = r.data;
    error = r.error;
  }
  if (error || !data) return { error: 'No se pudo crear el marcador: ' + (error?.message ?? '') };

  redirect(`/admin/marcadores/${data.id}/control`);
}

export async function eliminarMarcador(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('marcadores').delete().eq('id', id);
  refresh();
}

export async function prorrogarMarcador(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const horas = Math.max(1, parseInt((formData.get('horas') as string) || '24', 10));
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({ expira_en: new Date(Date.now() + horas * 3600 * 1000).toISOString() })
    .eq('id', id);
  refresh();
}
