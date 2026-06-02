import { createClient } from '@/lib/supabase/server';

// Devuelve los contactos del staff visibles para la sesión actual.
// RLS: logueado -> todos los activos; anónimo -> solo el contacto por defecto.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff')
    .select('id, nombre, cargo, whatsapp, foto_url')
    .eq('activo', true)
    .order('orden', { ascending: true });
  return Response.json(data ?? []);
}
