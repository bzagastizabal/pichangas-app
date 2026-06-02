'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export async function crearCategoria(formData: FormData): Promise<void> {
  await requireAdmin();
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!nombre) return;
  const min = parseInt((formData.get('edad_min') as string) || '', 10);
  const max = parseInt((formData.get('edad_max') as string) || '', 10);
  const supabase = await createClient();
  await supabase.from('categorias').insert({
    nombre,
    edad_min: Number.isFinite(min) && min >= 0 ? min : null,
    edad_max: Number.isFinite(max) && max >= 0 ? max : null,
  });
  refresh();
}

// Actualiza el rango de edad de una categoría existente (inline en la lista).
export async function guardarRangoCategoria(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const min = parseInt((formData.get('edad_min') as string) || '', 10);
  const max = parseInt((formData.get('edad_max') as string) || '', 10);
  const supabase = await createClient();
  await supabase
    .from('categorias')
    .update({
      edad_min: Number.isFinite(min) && min >= 0 ? min : null,
      edad_max: Number.isFinite(max) && max >= 0 ? max : null,
    })
    .eq('id', id);
  refresh();
}

export async function alternarActivoCategoria(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  const supabase = await createClient();
  await supabase.from('categorias').update({ activo: !activo }).eq('id', id);
  refresh();
}

export async function eliminarCategoria(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  // categoria_id en eventos es ON DELETE SET NULL: borrar no rompe eventos.
  await supabase.from('categorias').delete().eq('id', id);
  refresh();
}
