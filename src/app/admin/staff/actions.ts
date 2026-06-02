'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const BUCKET_FOTOS = 'staff_fotos';

function tel(v: FormDataEntryValue | null): string | null {
  const d = (typeof v === 'string' ? v : '').replace(/\D/g, '');
  return d || null;
}

// Sube la foto del staff al bucket público y devuelve el path. Reemplaza la
// anterior si la hay (mismo path por id, distinto sufijo de timestamp).
async function subirFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  file: File,
  pathAnterior: string | null,
): Promise<string | null> {
  if (file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return null;
  if (pathAnterior) {
    await supabase.storage.from(BUCKET_FOTOS).remove([pathAnterior]);
  }
  return path;
}

export async function crearStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!nombre) return;
  const supabase = await createClient();
  const esDefault = formData.get('es_default') === 'on';
  if (esDefault) await supabase.from('staff').update({ es_default: false }).eq('es_default', true);
  const { data: nuevo } = await supabase
    .from('staff')
    .insert({
      nombre,
      cargo: ((formData.get('cargo') as string) || '').trim() || null,
      whatsapp: tel(formData.get('whatsapp')),
      es_default: esDefault,
    })
    .select('id')
    .single();
  // Sube la foto si vino (en el form de alta es opcional).
  const foto = formData.get('foto') as File | null;
  if (nuevo?.id && foto && foto.size > 0) {
    const path = await subirFoto(supabase, nuevo.id, foto, null);
    if (path) await supabase.from('staff').update({ foto_url: path }).eq('id', nuevo.id);
  }
  refresh();
}

export async function guardarStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = await createClient();
  const esDefault = formData.get('es_default') === 'on';
  if (esDefault) await supabase.from('staff').update({ es_default: false }).eq('es_default', true);

  // Foto: si suben una nueva, la reemplaza; si marcan "quitar", borra la anterior.
  const foto = formData.get('foto') as File | null;
  const quitar = formData.get('quitar_foto') === 'on';
  const { data: actual } = await supabase
    .from('staff')
    .select('foto_url')
    .eq('id', id)
    .maybeSingle();
  let foto_url: string | null | undefined = undefined; // undefined = no tocar
  if (foto && foto.size > 0) {
    const path = await subirFoto(supabase, id, foto, actual?.foto_url ?? null);
    if (path) foto_url = path;
  } else if (quitar && actual?.foto_url) {
    await supabase.storage.from(BUCKET_FOTOS).remove([actual.foto_url]);
    foto_url = null;
  }

  await supabase
    .from('staff')
    .update({
      nombre: ((formData.get('nombre') as string) || '').trim(),
      cargo: ((formData.get('cargo') as string) || '').trim() || null,
      whatsapp: tel(formData.get('whatsapp')),
      activo: formData.get('activo') === 'on',
      es_default: esDefault,
      ...(foto_url !== undefined ? { foto_url } : {}),
    })
    .eq('id', id);
  redirect('/admin/staff');
}

export async function marcarDefault(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('staff').update({ es_default: false }).eq('es_default', true);
  await supabase.from('staff').update({ es_default: true }).eq('id', id);
  refresh();
}

export async function alternarActivoStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  const supabase = await createClient();
  await supabase.from('staff').update({ activo: !activo }).eq('id', id);
  refresh();
}

export async function eliminarStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { data: actual } = await supabase
    .from('staff')
    .select('foto_url')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('staff').delete().eq('id', id);
  if (actual?.foto_url) {
    await supabase.storage.from(BUCKET_FOTOS).remove([actual.foto_url]);
  }
  refresh();
}
