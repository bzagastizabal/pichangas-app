// src/app/admin/sonidos/actions.ts
// Efectos de sonido del cronómetro (SQL 40): subida al bucket público
// 'efectos' y gestión de la fila. El disparo NO vive aquí: va por RPC desde
// el visor (admin u operador con link).
'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { BUCKET_EFECTOS, nombreDesdeArchivo } from '@/lib/sonidos';

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB: un efecto dura 1-3 s.

// Sube uno o varios audios. El nombre sale del archivo y se edita después.
export async function subirEfectos(formData: FormData): Promise<void> {
  const perfil = await requireAdmin();
  const archivos = formData.getAll('archivos').filter((a): a is File => a instanceof File);
  if (!archivos.length) return;
  const supabase = await createClient();

  // Los nuevos van al final del panel.
  const { data: ultimo } = await supabase
    .from('efectos_sonido')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  let orden = ((ultimo as { orden: number } | null)?.orden ?? 0) + 1;

  for (const file of archivos) {
    if (file.size === 0 || file.size > MAX_BYTES) continue;
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_EFECTOS)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) continue;
    await supabase.from('efectos_sonido').insert({
      nombre: nombreDesdeArchivo(file.name),
      path,
      orden: orden++,
      creado_por: perfil.id,
    });
  }
  refresh();
}

export async function actualizarEfecto(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const nombre = ((formData.get('nombre') as string) || '').trim();
  // Un emoji (o dos): es la cara del botón en el panel del cronómetro.
  const emoji = ((formData.get('emoji') as string) || '').trim().slice(0, 8) || null;
  const orden = parseInt((formData.get('orden') as string) || '0', 10) || 0;
  const supabase = await createClient();
  await supabase
    .from('efectos_sonido')
    .update({ nombre: nombre.slice(0, 60) || 'Efecto', emoji, orden })
    .eq('id', id);
  refresh();
}

export async function alternarEfecto(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('efectos_sonido').update({ activo: !activo }).eq('id', id);
  refresh();
}

export async function eliminarEfecto(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from('efectos_sonido')
    .select('path')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('efectos_sonido').delete().eq('id', id);
  const path = (data as { path: string } | null)?.path;
  if (path) await supabase.storage.from(BUCKET_EFECTOS).remove([path]);
  refresh();
}
