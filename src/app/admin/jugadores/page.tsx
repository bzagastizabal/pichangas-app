import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { JugadorForm } from './JugadorForm';
import { BotonReiniciar } from './BotonReiniciar';
import { alternarActivoJugador } from './actions';

type PerfilFila = {
  id: string;
  nombre_completo: string | null;
  dni: string | null;
  telefono: string | null;
  rol: 'participante' | 'administrador';
  activo: boolean;
};

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, dni, telefono, rol, activo')
    .order('nombre_completo');
  const perfiles = (data as PerfilFila[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Jugadores</h1>

      {ok && (
        <p className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-borde p-4">
        <h2 className="font-semibold mb-3">Crear jugador</h2>
        <JugadorForm />
        <p className="mt-2 text-xs text-tenue">
          Útil para quienes no pueden registrarse solos. Luego puedes inscribirlos
          a un evento desde “Participantes”.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">DNI</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className={`border-t border-borde ${p.activo ? '' : 'opacity-50'}`}>
                <td className="p-3">{p.nombre_completo ?? '—'}</td>
                <td className="p-3 text-tenue">{p.dni ?? '—'}</td>
                <td className="p-3 text-tenue">{p.telefono ?? '—'}</td>
                <td className="p-3 text-tenue">{p.rol}</td>
                <td className="p-3">
                  {p.activo ? (
                    <span className="text-green-400">activo</span>
                  ) : (
                    <span className="text-tenue">de baja</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/admin/jugadores/${p.id}/editar`}
                      className="text-orange-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <BotonReiniciar id={p.id} nombre={p.nombre_completo ?? 'este jugador'} />
                    <form action={alternarActivoJugador}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="activo" value={String(p.activo)} />
                      <button type="submit" className="text-tenue hover:underline">
                        {p.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
