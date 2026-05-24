'use server';

import { createClient } from '@/lib/supabase/server';
import { getSesion } from '@/lib/auth';

// El propio usuario cambia su contraseña.
export async function cambiarMiPassword(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const { user } = await getSesion();
  if (!user) return { error: 'No autenticado.' };
  const pass = ((formData.get('password') as string) || '').trim();
  const conf = ((formData.get('confirmar') as string) || '').trim();
  if (pass.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' };
  if (pass !== conf) return { error: 'Las contraseñas no coinciden.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pass });
  if (error) return { error: 'No se pudo cambiar: ' + error.message };
  return { ok: true };
}
