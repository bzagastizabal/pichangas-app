'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// Resuelve el correo a partir del DNI (para permitir login por DNI).
export async function emailPorDni(dni: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('perfiles').select('id').eq('dni', dni).maybeSingle();
  if (!data) return null;
  const { data: u } = await admin.auth.admin.getUserById(data.id);
  return u?.user?.email ?? null;
}
