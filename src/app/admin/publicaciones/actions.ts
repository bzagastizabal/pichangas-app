'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Crea una publicación. Las imágenes ya fueron comprimidas y subidas por el
// cliente (al bucket público); aquí solo se guardan sus rutas.
export async function crearPublicacion(datos: {
  titulo: string;
  descripcion: string;
  eventoId: string | null;
  imagenes: string[];
}): Promise<{ error?: string }> {
  const perfil = await requireAdmin();
  const titulo = (datos.titulo || '').trim();
  if (!titulo) return { error: 'El título es obligatorio.' };

  const supabase = await createClient();
  const { error } = await supabase.from('publicaciones').insert({
    titulo,
    descripcion: (datos.descripcion || '').trim() || null,
    evento_id: datos.eventoId || null,
    imagenes: datos.imagenes ?? [],
    autor_id: perfil.id,
  });
  if (error) return { error: 'No se pudo publicar: ' + error.message };

  refresh();
  return {};
}

export async function eliminarPublicacion(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  let imagenes: string[] = [];
  try {
    imagenes = JSON.parse((formData.get('imagenes') as string) || '[]');
  } catch {
    imagenes = [];
  }
  const supabase = await createClient();
  if (imagenes.length) await supabase.storage.from('publicaciones').remove(imagenes);
  await supabase.from('publicaciones').delete().eq('id', id);
  refresh();
}
