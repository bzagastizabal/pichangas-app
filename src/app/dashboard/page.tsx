// src/app/dashboard/page.tsx
// Página PROTEGIDA. Si no hay sesión, redirige a /login.
// Lee el perfil del usuario desde tu tabla `perfiles` para verificar
// que TODA la cadena funciona: Auth -> trigger -> perfil -> RLS.
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Notificacion } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { marcarNotificacionesLeidas } from './actions';
import { cerrarSesion } from '@/lib/auth-actions';
import { Pista } from '@/components/Pista';
import { MarcaClub } from '@/components/MarcaClub';
import { BannerMarchaBlanca } from '@/components/BannerMarchaBlanca';
import { CumpleanosDelMes } from '@/components/CumpleanosDelMes';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

type EventoLista = {
  id: string;
  slug_inscripcion: string;
  fecha_hora_evento: string;
  costo_por_participante: number;
  categoria_id: string | null;
  sedes: { nombre: string } | null;
};

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

  // Pichangas abiertas y aún por jugarse, para inscribirse.
  const { data: eventosData } = await supabase
    .from('eventos')
    .select('id, slug_inscripcion, fecha_hora_evento, costo_por_participante, categoria_id, sedes(nombre)')
    .eq('estado', 'abierta')
    .gte('fecha_hora_evento', new Date().toISOString())
    .order('fecha_hora_evento', { ascending: true });
  const eventosTodos = (eventosData as unknown as EventoLista[]) ?? [];

  // Categorías del jugador: ve eventos sin categoría + los de sus categorías.
  const { data: misCats } = await supabase
    .from('perfil_categorias')
    .select('categoria_id')
    .eq('perfil_id', user.id);
  const misCatIds = new Set(((misCats as { categoria_id: string }[]) ?? []).map((x) => x.categoria_id));
  const eventos = eventosTodos.filter((ev) => !ev.categoria_id || misCatIds.has(ev.categoria_id));

  const { data: misInsc } = await supabase
    .from('inscripciones')
    .select('evento_id, estado')
    .eq('usuario_id', user.id)
    .in('estado', ['pendiente', 'confirmado', 'lista_espera']);
  const miEstado = new Map(
    ((misInsc as { evento_id: string; estado: string }[]) ?? []).map((i) => [i.evento_id, i.estado]),
  );

  return (
    <div className="max-w-md mx-auto mt-16 p-6 space-y-3">
      <div className="flex items-center gap-3">
        <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-16 w-auto" />
        <MarcaClub align="left" />
      </div>
      <BannerMarchaBlanca />
      <CumpleanosDelMes />
      <h1 className="text-2xl font-bold">
        Hola, {perfil?.nombre_completo ?? 'jugador'} 🏀
      </h1>
      <p className="text-sm text-tenue">Correo: {user.email}</p>
      <p className="text-sm text-tenue">Rol: {perfil?.rol}</p>
      <p className="text-green-600 font-medium">
        ✅ Online
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {perfil?.rol === 'administrador' && (
          <Link
            href="/admin"
            className="inline-block bg-orange-600 text-white px-4 py-2 rounded text-sm"
          >
            Ir al panel de administración →
          </Link>
        )}
        <Link
          href="/publicaciones"
          className="text-sm text-tenue hover:text-orange-600 border border-borde rounded px-4 py-2"
        >
          Novedades
        </Link>
        <Link
          href="/cuenta/clave"
          className="text-sm text-tenue hover:text-orange-600 border border-borde rounded px-4 py-2"
        >
          Cambiar contraseña
        </Link>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="text-sm text-tenue hover:text-orange-600 border border-borde rounded px-4 py-2"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <section className="pt-4 border-t border-borde">
        <h2 className="font-semibold mb-2">
          Próximas pichangas
          <Pista texto="Solo ves las pichangas abiertas, por jugarse y de tus categorías (o sin categoría). Toca Inscribirme para reservar tu cupo." />
        </h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-tenue">No hay pichangas abiertas ahora.</p>
        ) : (
          <ul className="space-y-2">
            {eventos.map((ev) => {
              const estado = miEstado.get(ev.id);
              return (
                <li
                  key={ev.id}
                  className="rounded-lg border border-borde p-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium">{ev.sedes?.nombre ?? 'Pichanga'}</p>
                    <p className="text-xs text-tenue">
                      {formatearFechaLima(ev.fecha_hora_evento)} ·{' '}
                      {soles.format(ev.costo_por_participante)}
                    </p>
                  </div>
                  {estado ? (
                    <Link
                      href={`/inscribir/${ev.slug_inscripcion}`}
                      className="text-sm text-green-400 hover:underline"
                    >
                      {estado === 'lista_espera'
                        ? 'En lista de espera'
                        : estado === 'confirmado'
                          ? 'Confirmado'
                          : 'Inscrito'}{' '}
                      · ver
                    </Link>
                  ) : (
                    <Link
                      href={`/inscribir/${ev.slug_inscripcion}`}
                      className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded"
                    >
                      Inscribirme →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pt-4 border-t border-borde">
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
          <p className="text-sm text-tenue">No tienes avisos.</p>
        ) : (
          <ul className="space-y-2">
            {notificaciones.map((n) => (
              <li
                key={n.id}
                className={`rounded border p-2 text-sm ${
                  n.leida
                    ? 'border-borde text-tenue'
                    : 'border-orange-500/40 bg-orange-500/10'
                }`}
              >
                <p>{n.mensaje}</p>
                <p className="text-xs text-tenue">{formatearFechaLima(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
