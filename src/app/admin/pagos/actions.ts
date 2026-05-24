// src/app/admin/pagos/actions.ts
// Server Actions del panel de aprobación de pagos. Delegan en RPCs atómicas
// (aprobar_pago / rechazar_pago) que verifican es_admin() en la BD.
'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export async function aprobarPago(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  await supabase.rpc('aprobar_pago', { p_pago_id: id });
  refresh();
}

export async function rechazarPago(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const motivo = (formData.get('motivo') as string | null) ?? '';
  const supabase = await createClient();
  await supabase.rpc('rechazar_pago', { p_pago_id: id, p_motivo: motivo });
  refresh();
}
