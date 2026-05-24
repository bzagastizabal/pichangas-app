'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// Registra un pago a la sede o al árbitro del evento (egreso).
export async function registrarEgreso(formData: FormData): Promise<void> {
  const perfil = await requireAdmin();
  const eventoId = formData.get('evento_id') as string;
  const tipo = formData.get('tipo') as string;
  const monto = Number(formData.get('monto'));
  const metodo = (formData.get('metodo') as string) || null;
  const fecha = (formData.get('fecha_pago') as string) || '';
  const nota = ((formData.get('nota') as string) || '').trim() || null;

  if (!eventoId || !['sede', 'arbitro', 'otro'].includes(tipo)) return;
  if (Number.isNaN(monto) || monto <= 0) return;

  const supabase = await createClient();
  const { data: ev } = await supabase
    .from('eventos')
    .select('sede_id, arbitro_id')
    .eq('id', eventoId)
    .maybeSingle();
  if (!ev) return;

  await supabase.from('egresos').insert({
    evento_id: eventoId,
    tipo,
    sede_id: tipo === 'sede' ? ev.sede_id : null,
    arbitro_id: tipo === 'arbitro' ? ev.arbitro_id : null,
    monto,
    metodo,
    fecha_pago: fecha ? `${fecha}T12:00:00-05:00` : undefined,
    nota,
    registrado_por: perfil.id,
  });
  refresh();
}

export async function eliminarEgreso(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.from('egresos').delete().eq('id', id);
  refresh();
}
