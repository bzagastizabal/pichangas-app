'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

function tel(v: FormDataEntryValue | null): string | null {
  const d = (typeof v === 'string' ? v : '').replace(/\D/g, '');
  return d || null;
}

export async function crearStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const nombre = ((formData.get('nombre') as string) || '').trim();
  if (!nombre) return;
  const supabase = await createClient();
  const esDefault = formData.get('es_default') === 'on';
  if (esDefault) await supabase.from('staff').update({ es_default: false }).eq('es_default', true);
  await supabase.from('staff').insert({
    nombre,
    cargo: ((formData.get('cargo') as string) || '').trim() || null,
    whatsapp: tel(formData.get('whatsapp')),
    es_default: esDefault,
  });
  refresh();
}

export async function guardarStaff(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = await createClient();
  const esDefault = formData.get('es_default') === 'on';
  if (esDefault) await supabase.from('staff').update({ es_default: false }).eq('es_default', true);
  await supabase
    .from('staff')
    .update({
      nombre: ((formData.get('nombre') as string) || '').trim(),
      cargo: ((formData.get('cargo') as string) || '').trim() || null,
      whatsapp: tel(formData.get('whatsapp')),
      activo: formData.get('activo') === 'on',
      es_default: esDefault,
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
  await supabase.from('staff').delete().eq('id', id);
  refresh();
}
