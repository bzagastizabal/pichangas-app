// src/app/admin/voces/actions.ts
// Packs de voz del cronómetro (SQL 37): alta/baja de packs y subida de clips
// al bucket público 'voces'. Cada clip vive en {paquete_id}/{clave}-{ts}.{ext}
// y la fila de voces_clips es la que manda (el visor resuelve por clave).
'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { BUCKET_VOCES, RANURAS, claveDesdeNombre } from '@/lib/voces';

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB por clip: de sobra para 2-3 s.
const CLAVES = new Set(RANURAS.map((r) => r.clave));

export async function crearPaquete(formData: FormData): Promise<void> {
  await requireAdmin();
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!nombre) return;
  const descripcion = ((formData.get('descripcion') as string) || '').trim() || null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('voces_paquetes')
    .insert({ nombre: nombre.slice(0, 80), descripcion })
    .select('id')
    .single();
  if (data?.id) redirect(`/admin/voces/${data.id}`);
  refresh();
}

export async function renombrarPaquete(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!id || !nombre) return;
  const supabase = await createClient();
  await supabase
    .from('voces_paquetes')
    .update({
      nombre: nombre.slice(0, 80),
      descripcion: ((formData.get('descripcion') as string) || '').trim() || null,
    })
    .eq('id', id);
  refresh();
}

export async function eliminarPaquete(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = await createClient();
  // Borra primero los archivos: el DELETE de la fila los perdería de vista.
  const { data: clips } = await supabase
    .from('voces_clips')
    .select('path')
    .eq('paquete_id', id);
  const paths = (clips as Array<{ path: string }> | null)?.map((c) => c.path) ?? [];
  if (paths.length) await supabase.storage.from(BUCKET_VOCES).remove(paths);
  await supabase.from('voces_paquetes').delete().eq('id', id);
  redirect('/admin/voces');
}

// Sube uno o varios clips. Si viene `clave`, todos los archivos van a esa
// ranura (subida desde un slot); si no, se deduce por el nombre del archivo.
export async function subirClips(formData: FormData): Promise<void> {
  await requireAdmin();
  const paqueteId = formData.get('paquete_id') as string;
  if (!paqueteId) return;
  const claveFija = ((formData.get('clave') as string) || '').trim();
  const archivos = formData.getAll('archivos').filter((a): a is File => a instanceof File);
  if (!archivos.length) return;

  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from('voces_clips')
    .select('id, clave, path')
    .eq('paquete_id', paqueteId);
  const previos = new Map(
    ((existentes as Array<{ id: string; clave: string; path: string }> | null) ?? []).map(
      (c) => [c.clave, c],
    ),
  );

  for (const file of archivos) {
    if (file.size === 0 || file.size > MAX_BYTES) continue;
    const clave = claveFija || claveDesdeNombre(file.name) || '';
    if (!CLAVES.has(clave)) continue; // nombre no reconocido: se ignora.
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${paqueteId}/${clave}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_VOCES)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) continue;
    const previo = previos.get(clave);
    if (previo) {
      await supabase.from('voces_clips').update({ path }).eq('id', previo.id);
      await supabase.storage.from(BUCKET_VOCES).remove([previo.path]);
      previos.set(clave, { ...previo, path });
    } else {
      const { data } = await supabase
        .from('voces_clips')
        .insert({ paquete_id: paqueteId, clave, path })
        .select('id')
        .single();
      if (data?.id) previos.set(clave, { id: data.id, clave, path });
    }
  }
  refresh();
}

export async function eliminarClip(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from('voces_clips')
    .select('path')
    .eq('id', id)
    .maybeSingle();
  const path = (data as { path: string } | null)?.path;
  await supabase.from('voces_clips').delete().eq('id', id);
  if (path) await supabase.storage.from(BUCKET_VOCES).remove([path]);
  refresh();
}
