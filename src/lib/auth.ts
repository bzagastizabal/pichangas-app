// src/lib/auth.ts
// Helpers de sesión y autorización reutilizables en páginas y Server Actions.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Perfil = {
  id: string;
  nombre_completo: string | null;
  rol: 'participante' | 'administrador';
};

// Devuelve el usuario de Auth y su perfil (o null si no hay sesión).
export async function getSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, perfil: null };

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .eq('id', user.id)
    .single();

  return { user, perfil: (perfil as Perfil) ?? null };
}

// Exige sesión + rol administrador. Redirige si no cumple.
// Úsalo al inicio de páginas de admin y de TODA Server Action de admin
// (las Server Actions son invocables por POST directo: nunca confíes solo en la UI).
export async function requireAdmin(): Promise<Perfil> {
  const { user, perfil } = await getSesion();
  if (!user) redirect('/login');
  if (perfil?.rol !== 'administrador') redirect('/dashboard');
  return perfil;
}
