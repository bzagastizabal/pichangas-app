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

// Suma/resta segundos al reloj — útil para el modo cronómetro. Si está
// corriendo, congela → aplica delta → vuelve a arrancar para no perder ms
// residuales por el tick del RAF.
export async function ajustarCronometro(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const delta = parseInt((formData.get('delta') as string) || '0', 10);
  if (!id || !delta) return;
  const m = await leer(id);
  if (!m) return;
  const supabase = await createClient();
  const restanteReal = msRestantes(m.reloj_restante_ms, m.reloj_corriendo, m.reloj_inicio);
  const nuevo = Math.max(0, restanteReal + delta * 1000);
  const upd: Record<string, unknown> = {
    reloj_restante_ms: nuevo,
  };
  if (m.reloj_corriendo) {
    // Rearrancamos desde el nuevo valor.
    upd.reloj_inicio = new Date().toISOString();
  }
  await supabase.from('marcadores').update(upd).eq('id', id);
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

// Acepta también color del nombre por equipo (SQL 30) y título opcional (SQL 32).
// Si las columnas aún no existen, reintenta con menos campos.
export async function renombrarEquipos(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const nombre_local = ((formData.get('nombre_local') as string) || '').trim();
  const nombre_visitante = ((formData.get('nombre_visitante') as string) || '').trim();
  if (!id || !nombre_local || !nombre_visitante) return;
  const hex = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
  const cl_raw = ((formData.get('color_local') as string) || '').trim();
  const cv_raw = ((formData.get('color_visitante') as string) || '').trim();
  const color_local = hex.test(cl_raw) ? cl_raw : '#ffffff';
  const color_visitante = hex.test(cv_raw) ? cv_raw : '#ffffff';
  const tituloRaw = ((formData.get('titulo') as string) || '').trim();
  const titulo = tituloRaw.length ? tituloRaw.slice(0, 200) : null;
  const supabase = await createClient();
  const upd: Record<string, unknown> = {
    nombre_local, nombre_visitante,
    color_local, color_visitante,
    titulo,
  };
  const r = await supabase.from('marcadores').update(upd).eq('id', id);
  if (r.error && /titulo/.test(r.error.message)) {
    delete upd.titulo;
    const r2 = await supabase.from('marcadores').update(upd).eq('id', id);
    if (r2.error && /color_(local|visitante)/.test(r2.error.message)) {
      await supabase.from('marcadores')
        .update({ nombre_local, nombre_visitante })
        .eq('id', id);
    }
  } else if (r.error && /color_(local|visitante)/.test(r.error.message)) {
    await supabase.from('marcadores')
      .update({ nombre_local, nombre_visitante })
      .eq('id', id);
  }
  refresh();
}

// Actualiza estilo visual del marcador (SQL 31). Fallback si columnas ausentes.
const FUENTES_VALIDAS = new Set(['orbitron', 'bebas', 'anton', 'iceland', 'rubik_mono', 'led']);
const HEX = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
export async function actualizarEstilo(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const fuenteRaw = ((formData.get('fuente') as string) || '').trim();
  const cplRaw = ((formData.get('color_puntos_local') as string) || '').trim();
  const cpvRaw = ((formData.get('color_puntos_visitante') as string) || '').trim();
  const cfRaw  = ((formData.get('color_fondo') as string) || '').trim();
  const neon = formData.get('neon') === 'on';
  const bocinaRaw = ((formData.get('bocina_tipo') as string) || '').trim();
  const BOCINAS_VALIDAS = new Set(['ncaa', 'nba', 'high_school', 'air_horn']);
  const upd: Record<string, string | boolean> = {
    fuente: FUENTES_VALIDAS.has(fuenteRaw) ? fuenteRaw : 'orbitron',
    color_puntos_local:     HEX.test(cplRaw) ? cplRaw : '#ffffff',
    color_puntos_visitante: HEX.test(cpvRaw) ? cpvRaw : '#ffffff',
    color_fondo:            HEX.test(cfRaw)  ? cfRaw  : '#000000',
    neon,
    bocina_tipo: BOCINAS_VALIDAS.has(bocinaRaw) ? bocinaRaw : 'ncaa',
  };
  const supabase = await createClient();
  const r = await supabase.from('marcadores').update(upd).eq('id', id);
  if (r.error && /bocina_tipo/.test(r.error.message)) {
    delete upd.bocina_tipo;
    const r2 = await supabase.from('marcadores').update(upd).eq('id', id);
    if (r2.error && /neon/.test(r2.error.message)) {
      delete upd.neon;
      await supabase.from('marcadores').update(upd).eq('id', id);
    }
    return;
  }
  if (r.error && /neon/.test(r.error.message)) {
    delete upd.neon;
    await supabase.from('marcadores').update(upd).eq('id', id);
    return;
  }
  if (r.error && /fuente|color_puntos|color_fondo/.test(r.error.message)) {
    // Columnas aún no creadas: no bloquear al admin.
    return;
  }
  refresh();
}

// Suena la bocina: incrementa el contador bocina_pulsos en el marcador.
// El visor lo escucha por Realtime y reproduce el horn al detectar el cambio.
export async function sonarBocina(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  // El RPC usa sesión del admin para que es_admin() vea su auth.uid().
  const supabase = await createClient();
  await supabase.rpc('marcador_bocina', { p_id: id });
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

// Guarda la config de avisos del cronómetro (SQL 36). Si la migración aún no
// corrió, ignora en silencio para no romper el panel (mismo patrón que estilo).
export async function actualizarAvisos(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const avisos = formData
    .getAll('avisos_seg')
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 3600)
    .sort((a, b) => b - a);
  const repetir = clamp(parseInt((formData.get('avisos_repetir') as string) || '2', 10) || 2, 1, 3);
  const beep = clamp(parseInt((formData.get('beep_desde_seg') as string) || '15', 10) || 0, 0, 60);
  const cuenta = clamp(parseInt((formData.get('voz_cuenta_desde') as string) || '0', 10) || 0, 0, 20);
  const supabase = await createClient();
  const r = await supabase
    .from('marcadores')
    .update({
      avisos_seg: avisos,
      avisos_repetir: repetir,
      beep_desde_seg: beep,
      voz_cuenta_desde: cuenta,
    })
    .eq('id', id);
  if (r.error) return; // columnas de SQL 36 ausentes: no bloquear al admin.
  refresh();
}

// Fija el total del cronómetro (minutos + segundos) y deja el reloj listo en
// ese valor, pausado. Sirve para reconfigurar desde el móvil sin volver al
// listado de marcadores.
export async function fijarTotalCronometro(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const min = clamp(parseInt((formData.get('crono_min') as string) || '0', 10) || 0, 0, 240);
  const seg = clamp(parseInt((formData.get('crono_seg') as string) || '0', 10) || 0, 0, 59);
  const total = Math.max(1, min * 60 + seg);
  const supabase = await createClient();
  await supabase
    .from('marcadores')
    .update({
      duracion_periodo_seg: total,
      reloj_restante_ms: total * 1000,
      reloj_corriendo: false,
      reloj_inicio: null,
    })
    .eq('id', id);
  refresh();
}
