// src/app/dashboard/actions.ts
'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSesion } from '@/lib/auth';

// Marca como leídas todas las notificaciones del usuario actual.
export async function marcarNotificacionesLeidas(): Promise<void> {
  const { user } = await getSesion();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', user.id)
    .eq('leida', false);
  refresh();
}
