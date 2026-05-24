// src/app/admin/arbitros/actions.ts
// Server Actions del CRUD de árbitros. Verifican admin (defensa en profundidad)
// además de la RLS de Supabase.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { EstadoForm } from '@/lib/types';

function opcional(v: FormDataEntryValue | null): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  return s === '' ? null : s;
}

// Devuelve los campos ya validados, o un mensaje de error.
function leerCampos(
  formData: FormData,
): { ok: true; campos: Record<string, unknown> } | { ok: false; error: string } {
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? '';
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' };

  const tarifa = Number(formData.get('tarifa_partido'));
  if (Number.isNaN(tarifa) || tarifa < 0) {
    return { ok: false, error: 'La tarifa por partido debe ser un número ≥ 0.' };
  }

  const califTexto = (formData.get('calificacion') as string | null)?.trim() ?? '';
  let calificacion: number | null = null;
  if (califTexto !== '') {
    calificacion = Number(califTexto);
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      return { ok: false, error: 'La calificación debe ser un entero del 1 al 5.' };
    }
  }

  return {
    ok: true,
    campos: {
      nombre,
      telefono: opcional(formData.get('telefono')),
      tarifa_partido: tarifa,
      precio_por_hora: Math.max(0, Number(formData.get('precio_por_hora')) || 0),
      calificacion,
      notas: opcional(formData.get('notas')),
      activo: formData.get('activo') === 'on',
    },
  };
}

export async function crearArbitro(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { error } = await supabase.from('arbitros').insert(r.campos);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect('/admin/arbitros');
}

export async function actualizarArbitro(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { error: 'Falta el identificador del árbitro.' };
  const r = leerCampos(formData);
  if (!r.ok) return { error: r.error };

  const supabase = await createClient();
  const { error } = await supabase.from('arbitros').update(r.campos).eq('id', id);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect('/admin/arbitros');
}

export async function alternarActivoArbitro(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  const supabase = await createClient();
  await supabase.from('arbitros').update({ activo: !activo }).eq('id', id);
  refresh();
}

export async function eliminarArbitro(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('arbitros').delete().eq('id', id);
  if (error) {
    redirect(
      '/admin/arbitros?error=' +
        encodeURIComponent(
          'No se pudo eliminar: el árbitro está en uso por un evento. Desactívalo en su lugar.',
        ),
    );
  }
  refresh();
}
