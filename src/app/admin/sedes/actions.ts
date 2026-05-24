// src/app/admin/sedes/actions.ts
// Server Actions del CRUD de sedes. Todas verifican admin (defensa en profundidad:
// son invocables por POST directo, no solo desde la UI). RLS en Supabase es la
// segunda barrera.
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { EstadoForm } from '@/lib/types';

// Convierte "" en null para columnas de texto opcionales.
function opcional(v: FormDataEntryValue | null): string | null {
  const s = (typeof v === 'string' ? v : '').trim();
  return s === '' ? null : s;
}

function leerCampos(formData: FormData) {
  return {
    nombre: (formData.get('nombre') as string | null)?.trim() ?? '',
    direccion: opcional(formData.get('direccion')),
    geolocalizacion: opcional(formData.get('geolocalizacion')),
    telefono_contacto: opcional(formData.get('telefono_contacto')),
    precio_por_hora: Math.max(0, Number(formData.get('precio_por_hora')) || 0),
    notas: opcional(formData.get('notas')),
    activo: formData.get('activo') === 'on',
  };
}

export async function crearSede(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const campos = leerCampos(formData);
  if (!campos.nombre) return { error: 'El nombre es obligatorio.' };

  const supabase = await createClient();
  const { error } = await supabase.from('sedes').insert(campos);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect('/admin/sedes');
}

export async function actualizarSede(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { error: 'Falta el identificador de la sede.' };
  const campos = leerCampos(formData);
  if (!campos.nombre) return { error: 'El nombre es obligatorio.' };

  const supabase = await createClient();
  const { error } = await supabase.from('sedes').update(campos).eq('id', id);
  if (error) return { error: 'No se pudo guardar: ' + error.message };

  redirect('/admin/sedes');
}

export async function alternarActivoSede(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  const supabase = await createClient();
  await supabase.from('sedes').update({ activo: !activo }).eq('id', id);
  refresh();
}

export async function eliminarSede(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.from('sedes').delete().eq('id', id);
  if (error) {
    // Suele fallar por estar referenciada en algún evento (FK). Mostramos aviso.
    redirect(
      '/admin/sedes?error=' +
        encodeURIComponent(
          'No se pudo eliminar: la sede está en uso por un evento. Desactívala en su lugar.',
        ),
    );
  }
  refresh();
}
