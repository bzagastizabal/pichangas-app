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
  const tipo = (formData.get('tipo_marcador') as string) || 'partido';
  const esCronometro = tipo === 'cronometro';
  const horas = Math.max(1, parseInt((formData.get('horas_expiracion') as string) || '24', 10));

  let baseInsert: Record<string, unknown>;
  if (esCronometro) {
    // Modo cronometro: reloj gigante con anuncios de voz. Sin equipos ni Q.
    const min = Math.max(0, parseInt((formData.get('crono_min') as string) || '5', 10));
    const seg = Math.max(0, Math.min(59, parseInt((formData.get('crono_seg') as string) || '0', 10)));
    const totalSeg = Math.max(1, min * 60 + seg);
    const titulo = ((formData.get('titulo_cronometro') as string) || '').trim() || null;
    baseInsert = {
      slug: nuevoSlug(),
      nombre_local: 'LOCAL',
      nombre_visitante: 'VISITANTE',
      duracion_periodo_seg: totalSeg,
      reloj_restante_ms: totalSeg * 1000,
      shot_duracion_ms: 24000,
      shot_restante_ms: 24000,
      tiene_reloj_periodo: true,
      tiene_shot_clock: false,
      tiene_periodo: false,
      es_cronometro: true,
      titulo,
      expira_en: new Date(Date.now() + horas * 3600 * 1000).toISOString(),
      creado_por: perfil.id,
    };
  } else {
    const nombre_local =
      ((formData.get('nombre_local') as string) || '').trim() || 'LOCAL';
    const nombre_visitante =
      ((formData.get('nombre_visitante') as string) || '').trim() || 'VISITANTE';
    const tiene_reloj_periodo = formData.get('tiene_reloj_periodo') === 'on';
    const tiene_shot_clock = formData.get('tiene_shot_clock') === 'on';
    const tiene_periodo = formData.get('tiene_periodo') === 'on';
    const minutos = Math.max(1, parseInt((formData.get('duracion_min') as string) || '10', 10));
    const shotSeg = Math.max(1, parseInt((formData.get('shot_seg') as string) || '24', 10));
    baseInsert = {
      slug: nuevoSlug(),
      nombre_local,
      nombre_visitante,
      duracion_periodo_seg: minutos * 60,
      reloj_restante_ms: minutos * 60 * 1000,
      shot_duracion_ms: shotSeg * 1000,
      shot_restante_ms: shotSeg * 1000,
      tiene_reloj_periodo,
      tiene_shot_clock,
      tiene_periodo,
      es_cronometro: false,
      expira_en: new Date(Date.now() + horas * 3600 * 1000).toISOString(),
      creado_por: perfil.id,
    };
  }

  const supabase = await createClient();
  let { data, error } = await supabase
    .from('marcadores')
    .insert(baseInsert)
    .select('id')
    .single();
  // Fallbacks si SQL 22/29/32/35 aún no corrieron: reintenta sin los campos
  // que la DB no reconoce.
  const REG_OPCIONALES = /tiene_(reloj_periodo|shot_clock|periodo)|es_cronometro|titulo/;
  if (error && REG_OPCIONALES.test(error.message)) {
    const sinOpcionales = { ...baseInsert };
    for (const k of ['tiene_reloj_periodo', 'tiene_shot_clock', 'tiene_periodo', 'es_cronometro', 'titulo']) {
      delete (sinOpcionales as Record<string, unknown>)[k];
    }
    const r = await supabase.from('marcadores').insert(sinOpcionales).select('id').single();
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
