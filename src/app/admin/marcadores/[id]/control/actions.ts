// src/app/admin/marcadores/[id]/control/actions.ts
// Operaciones del control. Cada acción lee el estado actual, calcula el nuevo
// (clave: pausar 'congela' los ms reales restantes) y persiste. Realtime se
// encarga de difundir el UPDATE a los suscriptores.
'use server';

import { createClient } from '@/lib/supabase/server';
import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { msRestantes, type Marcador } from '@/lib/types';

type Equipo = 'local' | 'visitante';

async function leer(id: string): Promise<Marcador | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('marcadores').select('*').eq('id', id).maybeSingle();
  return (data as Marcador | null) ?? null;
}

function clamp(n: number, min: number, max?: number) {
  if (n < min) return min;
  if (max != null && n > max) return max;
  return n;
}

export async function cambiarPuntos(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const equipo = formData.get('equipo') as Equipo;
  const delta = parseInt((formData.get('delta') as string) || '0', 10);
  if (!id || (equipo !== 'local' && equipo !== 'visitante')) return;
  const m = await leer(id);
  if (!m) return;
  const col = equipo === 'local' ? 'puntos_local' : 'puntos_visitante';
  const valor = clamp(m[col] + delta, 0);
  const supabase = await createClient();
  await supabase.from('marcadores').update({ [col]: valor }).eq('id', id);
}

export async function cambiarFaltas(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const equipo = formData.get('equipo') as Equipo;
  const delta = parseInt((formData.get('delta') as string) || '0', 10);
  if (!id) return;
  const m = await leer(id);
  if (!m) return;
  const col = equipo === 'local' ? 'faltas_local' : 'faltas_visitante';
  const valor = clamp(m[col] + delta, 0);
  const supabase = await createClient();
  await supabase.from('marcadores').update({ [col]: valor }).eq('id', id);
}

export async function cambiarTimeouts(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const equipo = formData.get('equipo') as Equipo;
  const delta = parseInt((formData.get('delta') as string) || '0', 10);
  if (!id) return;
  const m = await leer(id);
  if (!m) return;
  const col = equipo === 'local' ? 'timeouts_local' : 'timeouts_visitante';
  const valor = clamp(m[col] + delta, 0);
  const supabase = await createClient();
  await supabase.from('marcadores').update({ [col]: valor }).eq('id', id);
}

// Play/Pause sincroniza reloj principal Y shot clock.
export async function togglePlay(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const m = await leer(id);
  if (!m) return;
  const ahora = new Date().toISOString();
  const supabase = await createClient();
  if (m.reloj_corriendo) {
    // Pausar: congela los ms reales restantes ahora.
    const relojMs = msRestantes(m.reloj_restante_ms, true, m.reloj_inicio);
    const shotMs = msRestantes(m.shot_restante_ms, m.shot_corriendo, m.shot_inicio);
    await supabase
      .from('marcadores')
      .update({
        reloj_restante_ms: relojMs,
        reloj_corriendo: false,
        reloj_inicio: null,
        shot_restante_ms: shotMs,
        shot_corriendo: false,
        shot_inicio: null,
      })
      .eq('id', id);
  } else {
    // Reanudar.
    await supabase
      .from('marcadores')
      .update({
        reloj_corriendo: true,
        reloj_inicio: ahora,
        shot_corriendo: true,
        shot_inicio: ahora,
      })
      .eq('id', id);
  }
}

// Resetea el reloj principal al inicio del periodo (sin tocar puntos).
export async function resetReloj(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const m = await leer(id);
  if (!m) return;
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({
      reloj_restante_ms: m.duracion_periodo_seg * 1000,
      reloj_corriendo: false,
      reloj_inicio: null,
    })
    .eq('id', id);
}

export async function resetShot(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const segundos = parseInt((formData.get('segundos') as string) || '24', 10);
  const m = await leer(id);
  if (!m) return;
  const ms = clamp(segundos, 1) * 1000;
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({
      shot_duracion_ms: ms,
      shot_restante_ms: ms,
      // Si el reloj principal va, el shot también arranca; si no, queda pausado.
      shot_corriendo: m.reloj_corriendo,
      shot_inicio: m.reloj_corriendo ? new Date().toISOString() : null,
    })
    .eq('id', id);
}

export async function cambiarPeriodo(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const delta = parseInt((formData.get('delta') as string) || '0', 10);
  const m = await leer(id);
  if (!m) return;
  const periodo = clamp(m.periodo + delta, 1);
  // Al cambiar de periodo: reset reloj y faltas a 0; shot al inicial.
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({
      periodo,
      reloj_restante_ms: m.duracion_periodo_seg * 1000,
      reloj_corriendo: false,
      reloj_inicio: null,
      faltas_local: 0,
      faltas_visitante: 0,
      shot_restante_ms: m.shot_duracion_ms,
      shot_corriendo: false,
      shot_inicio: null,
    })
    .eq('id', id);
}

export async function renombrarEquipos(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const nombre_local = ((formData.get('nombre_local') as string) || '').trim();
  const nombre_visitante = ((formData.get('nombre_visitante') as string) || '').trim();
  if (!id || !nombre_local || !nombre_visitante) return;
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({ nombre_local, nombre_visitante })
    .eq('id', id);
  refresh();
}

// Reinicio total (mantiene nombres, duración y expiración).
export async function reiniciarPartido(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const m = await leer(id);
  if (!m) return;
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({
      puntos_local: 0,
      puntos_visitante: 0,
      faltas_local: 0,
      faltas_visitante: 0,
      timeouts_local: 2,
      timeouts_visitante: 2,
      periodo: 1,
      reloj_restante_ms: m.duracion_periodo_seg * 1000,
      reloj_corriendo: false,
      reloj_inicio: null,
      shot_restante_ms: m.shot_duracion_ms,
      shot_corriendo: false,
      shot_inicio: null,
    })
    .eq('id', id);
}
