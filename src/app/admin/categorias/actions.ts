'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export async function crearCategoria(formData: FormData): Promise<void> {
  await requireAdmin();
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!nombre) return;
  const supabase = await createClient();
  await supabase.from('categorias').insert({ nombre });
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
