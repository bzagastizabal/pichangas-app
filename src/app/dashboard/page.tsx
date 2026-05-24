// src/app/dashboard/page.tsx
// Página PROTEGIDA. Si no hay sesión, redirige a /login.
// Lee el perfil del usuario desde tu tabla `perfiles` para verificar
// que TODA la cadena funciona: Auth -> trigger -> perfil -> RLS.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Notificacion } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { marcarNotificacionesLeidas } from './actions';

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

  const { data: notifData } = await supabase
    .from('notificaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  const notificaciones = (notifData as Notificacion[]) ?? [];
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

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

      <section className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">
            Tus avisos{sinLeer > 0 ? ` (${sinLeer} sin leer)` : ''}
          </h2>
          {sinLeer > 0 && (
            <form action={marcarNotificacionesLeidas}>
              <button type="submit" className="text-xs text-orange-600 hover:underline">
                Marcar como leídas
              </button>
            </form>
          )}
        </div>
        {notificaciones.length === 0 ? (
          <p className="text-sm text-gray-400">No tienes avisos.</p>
        ) : (
          <ul className="space-y-2">
            {notificaciones.map((n) => (
              <li
                key={n.id}
                className={`rounded border p-2 text-sm ${
                  n.leida ? 'border-gray-100 text-gray-500' : 'border-orange-200 bg-orange-50'
                }`}
              >
                <p>{n.mensaje}</p>
                <p className="text-xs text-gray-400">{formatearFechaLima(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
