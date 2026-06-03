// src/app/admin/torneos/[id]/partidos/actions.ts
// CRUD del partido del torneo + asistencia.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { EstadoForm, EstadoPartido } from '@/lib/types';
import { datetimeLocalALimaISO } from '@/lib/fechas';

const ESTADOS: EstadoPartido[] = ['programado', 'jugado', 'wo', 'aplazado', 'cancelado'];

function txt(v: FormDataEntryValue | null): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  return s === '' ? null : s;
}

function numOptional(v: FormDataEntryValue | null): number | null {
  const s = (typeof v === 'string' ? v : '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function leerCampos(formData: FormData) {
  const torneo_id = (formData.get('torneo_id') as string | null) ?? '';
  if (!torneo_id) return { ok: false as const, error: 'Falta el torneo.' };

  const rival = ((formData.get('rival') as string | null) ?? '').trim();
  if (!rival) return { ok: false as const, error: 'El rival es obligatorio.' };

  const feLocal = ((formData.get('fecha') as string | null) ?? '').trim();
  if (!feLocal) return { ok: false as const, error: 'Falta la fecha del partido.' };
  const fecha = datetimeLocalALimaISO(feLocal);

  const estadoRaw = (formData.get('estado') as string | null) ?? 'programado';
  const estado: EstadoPartido = ESTADOS.includes(estadoRaw as EstadoPartido)
    ? (estadoRaw as EstadoPartido)
    : 'programado';

  return {
    ok: true as const,
    torneo_id,
    campos: {
      torneo_id,
      rival,
      fecha,
      ubicacion: txt(formData.get('ubicacion')),
      puntos_propio: numOptional(formData.get('puntos_propio')),
      puntos_rival: numOptional(formData.get('puntos_rival')),
      estado,
      notas: txt(formData.get('notas')),
    },
  };
}

export async function crearPartido(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('torneo_partidos')
    .insert(r.campos)
    .select('id, torneo_id')
    .single();
  if (error || !data) return { error: 'No se pudo crear: ' + (error?.message ?? '') };

  redirect(`/admin/torneos/${data.torneo_id}/partidos/${data.id}`);
}

export async function actualizarPartido(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { error: 'Falta el id.' };
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { error } = await supabase.from('torneo_partidos').update(r.campos).eq('id', id);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect(`/admin/torneos/${r.torneo_id}/partidos/${id}`);
}

export async function eliminarPartido(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const torneoId = formData.get('torneo_id') as string;
  const supabase = await createClient();
  await supabase.from('torneo_partidos').delete().eq('id', id);
  redirect(`/admin/torneos/${torneoId}`);
}

// Guarda la asistencia: por cada jugador del roster, jugo = true si está en
// formData.getAll('jugo'), false en caso contrario. Replace-all.
export async function guardarAsistencia(formData: FormData): Promise<void> {
  await requireAdmin();
  const partidoId = formData.get('partido_id') as string;
  if (!partidoId) return;

  const jugaron = new Set(
    formData.getAll('jugo').map((v) => String(v).trim()).filter(Boolean),
  );
  const rosterIds = formData
    .getAll('roster')
    .map((v) => String(v).trim())
    .filter(Boolean);

  const supabase = await createClient();
  await supabase.from('partido_jugadores').delete().eq('partido_id', partidoId);
  if (rosterIds.length > 0) {
    await supabase.from('partido_jugadores').insert(
      rosterIds.map((jugador_id) => ({
        partido_id: partidoId,
        jugador_id,
        jugo: jugaron.has(jugador_id),
      })),
    );
  }
  refresh();
}
