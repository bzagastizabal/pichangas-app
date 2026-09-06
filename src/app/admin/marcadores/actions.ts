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
    // Avisos (SQL 36): hitos marcados + repeticiones + beep inicial.
    const avisos_seg = formData
      .getAll('avisos_seg')
      .map((v) => parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 3600)
      .sort((a, b) => b - a);
    const avisos_repetir = Math.min(3, Math.max(1,
      parseInt((formData.get('avisos_repetir') as string) || '2', 10) || 2));
    const beep_desde_seg = Math.min(60, Math.max(0,
      parseInt((formData.get('beep_desde_seg') as string) || '15', 10) || 0));
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
      avisos_seg,
      avisos_repetir,
      beep_desde_seg,
      voz_cuenta_desde: 0,
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
  // Fallbacks si SQL 22/29/32/35/36 aún no corrieron: reintenta soltando un
  // grupo de columnas por vez, del más nuevo al más viejo, para no perder el
  // modo cronómetro solo porque falta la migración de los avisos.
  const REG_OPCIONALES =
    /tiene_(reloj_periodo|shot_clock|periodo)|es_cronometro|titulo|avisos_(seg|repetir)|beep_desde_seg|voz_cuenta_desde/;
  const GRUPOS_OPCIONALES: string[][] = [
    ['avisos_seg', 'avisos_repetir', 'beep_desde_seg', 'voz_cuenta_desde'], // SQL 36
    ['es_cronometro', 'titulo'],                                            // SQL 35 / 32
    ['tiene_reloj_periodo', 'tiene_shot_clock', 'tiene_periodo'],           // SQL 22 / 29
  ];
  const intento: Record<string, unknown> = { ...baseInsert };
  for (const grupo of GRUPOS_OPCIONALES) {
    if (!error || !REG_OPCIONALES.test(error.message)) break;
    for (const k of grupo) delete intento[k];
    const r = await supabase.from('marcadores').insert(intento).select('id').single();
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
