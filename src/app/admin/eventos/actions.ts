// src/app/admin/eventos/actions.ts
// Server Actions del CRUD de eventos (pichangas). Calculan costo_por_participante
// y generan el slug de inscripción. Verifican admin (defensa en profundidad) + RLS.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { calcularCostoPorParticipante, type EstadoEvento, type EstadoForm } from '@/lib/types';
import { datetimeLocalALimaISO, eventoYaTermino } from '@/lib/fechas';

type CamposValidados = {
  tipo: string;
  categoria_id: string | null;
  sede_id: string;
  arbitro_id: string | null;
  fecha_hora_evento: string;
  fecha_hora_limite_pago: string;
  duracion_horas: number;
  cupos_totales: number;
  minimo_requerido: number;
  costo_sede: number;
  costo_arbitraje: number;
  porcentaje_ganancia: number;
  costo_por_participante: number;
  pago_telefono: string | null;
  pago_titular: string | null;
  modo_cupos: 'inmediato' | 'tras_limite';
};

function num(formData: FormData, name: string): number {
  return Number(formData.get(name));
}

function validar(
  formData: FormData,
):
  | { ok: true; campos: CamposValidados; arbitros: string[] }
  | { ok: false; error: string } {
  const tipoRaw = (formData.get('tipo') as string | null)?.trim() ?? 'pichanga';
  const tipo = ['pichanga', 'amistoso', 'torneo'].includes(tipoRaw) ? tipoRaw : 'pichanga';
  const categoriaRaw = (formData.get('categoria_id') as string | null)?.trim() ?? '';
  const categoria_id = categoriaRaw === '' ? null : categoriaRaw;

  const sede_id = (formData.get('sede_id') as string | null)?.trim() ?? '';
  if (!sede_id) return { ok: false, error: 'Debes elegir una sede.' };

  // Varios árbitros por evento (checkboxes name="arbitros"). El primero se
  // guarda también en eventos.arbitro_id por compatibilidad con listados/joins.
  const arbitros = formData
    .getAll('arbitros')
    .map((v) => String(v).trim())
    .filter(Boolean);
  const arbitro_id = arbitros[0] ?? null;

  const feLocal = (formData.get('fecha_hora_evento') as string | null) ?? '';
  const flLocal = (formData.get('fecha_hora_limite_pago') as string | null) ?? '';
  if (!feLocal) return { ok: false, error: 'Falta la fecha y hora del evento.' };
  if (!flLocal) return { ok: false, error: 'Falta la fecha límite de pago.' };

  const fecha_hora_evento = datetimeLocalALimaISO(feLocal);
  const fecha_hora_limite_pago = datetimeLocalALimaISO(flLocal);
  if (new Date(fecha_hora_limite_pago) > new Date(fecha_hora_evento)) {
    return { ok: false, error: 'El límite de pago no puede ser posterior al evento.' };
  }

  const duracion_horas = num(formData, 'duracion_horas');
  if (
    Number.isNaN(duracion_horas) ||
    duracion_horas <= 0 ||
    duracion_horas * 2 !== Math.floor(duracion_horas * 2)
  ) {
    return {
      ok: false,
      error: 'La duración debe ser positiva y en pasos de media hora (1, 1.5, 2…).',
    };
  }

  const cupos_totales = num(formData, 'cupos_totales');
  if (!Number.isInteger(cupos_totales) || cupos_totales < 1) {
    return { ok: false, error: 'Los cupos totales deben ser un entero ≥ 1.' };
  }

  const minimo_requerido = num(formData, 'minimo_requerido');
  if (!Number.isInteger(minimo_requerido) || minimo_requerido < 0) {
    return { ok: false, error: 'El mínimo requerido debe ser un entero ≥ 0.' };
  }
  if (minimo_requerido > cupos_totales) {
    return { ok: false, error: 'El mínimo requerido no puede superar los cupos totales.' };
  }

  const costo_sede = num(formData, 'costo_sede');
  const costo_arbitraje = num(formData, 'costo_arbitraje');
  const porcentaje_ganancia = num(formData, 'porcentaje_ganancia');
  for (const [v, etiqueta] of [
    [costo_sede, 'costo de sede'],
    [costo_arbitraje, 'costo de arbitraje'],
    [porcentaje_ganancia, 'porcentaje de ganancia'],
  ] as const) {
    if (Number.isNaN(v) || v < 0) {
      return { ok: false, error: `El ${etiqueta} debe ser un número ≥ 0.` };
    }
  }

  const costo_por_participante = calcularCostoPorParticipante(
    costo_sede,
    costo_arbitraje,
    porcentaje_ganancia,
    cupos_totales,
  );

  const pago_titular = ((formData.get('pago_titular') as string) ?? '').trim() || null;
  // Normaliza a solo dígitos. Si quedan demasiado pocos lo guardamos null para
  // no mostrar un número roto a los jugadores.
  const telDigitos = ((formData.get('pago_telefono') as string) ?? '').replace(/\D/g, '');
  const pago_telefono = telDigitos.length >= 6 ? telDigitos : null;

  const modoRaw = (formData.get('modo_cupos') as string | null)?.trim() ?? 'inmediato';
  const modo_cupos: 'inmediato' | 'tras_limite' =
    modoRaw === 'tras_limite' ? 'tras_limite' : 'inmediato';

  return {
    ok: true,
    arbitros,
    campos: {
      tipo,
      categoria_id,
      sede_id,
      arbitro_id,
      fecha_hora_evento,
      fecha_hora_limite_pago,
      duracion_horas,
      cupos_totales,
      minimo_requerido,
      costo_sede,
      costo_arbitraje,
      porcentaje_ganancia,
      costo_por_participante,
      pago_telefono,
      pago_titular,
      modo_cupos,
    },
  };
}

// Reescribe la relación N-a-N evento <-> árbitros (borra y vuelve a insertar).
async function sincronizarArbitros(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventoId: string,
  arbitros: string[],
): Promise<void> {
  await supabase.from('evento_arbitros').delete().eq('evento_id', eventoId);
  if (arbitros.length > 0) {
    await supabase
      .from('evento_arbitros')
      .insert(arbitros.map((arbitro_id) => ({ evento_id: eventoId, arbitro_id })));
  }
}

function generarSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function crearEvento(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await requireAdmin();
  const r = validar(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('eventos')
    .insert({
      ...r.campos,
      admin_id: perfil.id,
      slug_inscripcion: generarSlug(),
    })
    .select('id')
    .single();
  if (error || !data) {
    return { error: 'No se pudo crear el evento: ' + (error?.message ?? '') };
  }

  await sincronizarArbitros(supabase, data.id, r.arbitros);

  redirect('/admin/eventos');
}

export async function actualizarEvento(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { error: 'Falta el identificador del evento.' };
  const r = validar(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  // Un evento ya realizado no se edita (se conserva como histórico). Para repetirlo
  // usa "Copiar".
  const { data: actual } = await supabase
    .from('eventos')
    .select('fecha_hora_evento, duracion_horas')
    .eq('id', id)
    .single();
  if (actual && eventoYaTermino(actual.fecha_hora_evento, actual.duracion_horas)) {
    return {
      error: 'Este evento ya se realizó; no se puede editar. Usa "Copiar" para crear uno nuevo.',
    };
  }
  // No tocamos slug_inscripcion ni admin_id en la edición.
  const { error } = await supabase.from('eventos').update(r.campos).eq('id', id);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  await sincronizarArbitros(supabase, id, r.arbitros);

  redirect('/admin/eventos');
}

export async function cambiarEstadoEvento(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const estado = formData.get('estado') as EstadoEvento;
  const supabase = await createClient();
  await supabase.from('eventos').update({ estado }).eq('id', id);
  refresh();
}

export async function eliminarEvento(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  if (error) {
    redirect(
      '/admin/eventos?error=' +
        encodeURIComponent(
          'No se pudo eliminar: el evento ya tiene inscripciones. Cámbialo a "cancelada" en su lugar.',
        ),
    );
  }
  refresh();
}
