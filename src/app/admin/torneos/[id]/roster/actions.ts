'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export async function guardarRoster(formData: FormData): Promise<void> {
  await requireAdmin();
  const torneoId = formData.get('torneo_id') as string;
  if (!torneoId) return;

  const seleccionados = formData
    .getAll('jugador')
    .map((v) => String(v).trim())
    .filter(Boolean);

  const supabase = await createClient();
  await supabase.from('torneo_jugadores').delete().eq('torneo_id', torneoId);
  if (seleccionados.length > 0) {
    await supabase
      .from('torneo_jugadores')
      .insert(seleccionados.map((jugador_id) => ({ torneo_id: torneoId, jugador_id })));
  }

  redirect(`/admin/torneos/${torneoId}`);
}
