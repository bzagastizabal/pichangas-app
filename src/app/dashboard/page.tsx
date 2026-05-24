// src/app/dashboard/page.tsx
// Página PROTEGIDA. Si no hay sesión, redirige a /login.
// Lee el perfil del usuario desde tu tabla `perfiles` para verificar
// que TODA la cadena funciona: Auth -> trigger -> perfil -> RLS.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Gracias a RLS, esta consulta solo devuelve el perfil del usuario actual.
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, rol, telefono')
    .eq('id', user.id)
    .single();

  return (
    <div className="max-w-md mx-auto mt-16 p-6 space-y-3">
      <h1 className="text-2xl font-bold">
        Hola, {perfil?.nombre_completo ?? 'jugador'} 🏀
      </h1>
      <p className="text-sm text-gray-600">Correo: {user.email}</p>
      <p className="text-sm text-gray-600">Rol: {perfil?.rol}</p>
      <p className="text-green-600 font-medium">
        ✅ Conexión Supabase + Auth + perfil funcionando.
      </p>
      {perfil?.rol === 'administrador' && (
        <Link
          href="/admin"
          className="inline-block bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          Ir al panel de administración →
        </Link>
      )}
    </div>
  );
}
