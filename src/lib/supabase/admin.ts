// Cliente Supabase con service-role. SOLO servidor: salta RLS, nunca importar
// desde código de cliente. Usa SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC).
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient solo puede usarse en el servidor.');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
