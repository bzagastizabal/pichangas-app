import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import { InvitarRegistro } from '@/app/admin/InvitarRegistro';
import { calcularEdad } from '@/lib/types';
import { JugadorForm } from './JugadorForm';
import { TablaJugadores, type FilaJugador } from './TablaJugadores';

type PerfilFila = {
  id: string;
  nombre_completo: string | null;
  dni: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  rol: 'participante' | 'administrador';
  activo: boolean;
};

type Orden = 'nombre' | 'edad' | 'dni' | 'nacionalidad';
type Dir = 'asc' | 'desc';

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; sort?: string; dir?: string }>;
}) {
  const { ok, error, sort, dir } = await searchParams;
  const supabase = await createClient();

  const { data: perfData } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, dni, telefono, fecha_nacimiento, nacionalidad, rol, activo');
  const perfiles = (perfData as PerfilFila[]) ?? [];
  const base = await baseUrl();

  const ordenarPor: Orden =
    sort === 'edad' || sort === 'dni' || sort === 'nacionalidad' ? sort : 'nombre';
  const direccion: Dir = dir === 'desc' ? 'desc' : 'asc';
  const sign = direccion === 'asc' ? 1 : -1;

  const filas: FilaJugador[] = perfiles
    .map((p) => ({
      id: p.id,
      nombre_completo: p.nombre_completo,
      dni: p.dni,
      telefono: p.telefono,
      nacionalidad: p.nacionalidad,
      rol: p.rol,
      activo: p.activo,
      edad: calcularEdad(p.fecha_nacimiento),
    }))
    .sort((a, b) => {
      const av =
        ordenarPor === 'nombre'
          ? (a.nombre_completo ?? '').toLocaleLowerCase('es')
          : ordenarPor === 'dni'
            ? a.dni ?? ''
            : ordenarPor === 'nacionalidad'
              ? (a.nacionalidad ?? '').toLocaleLowerCase('es')
              : a.edad;
      const bv =
        ordenarPor === 'nombre'
          ? (b.nombre_completo ?? '').toLocaleLowerCase('es')
          : ordenarPor === 'dni'
            ? b.dni ?? ''
            : ordenarPor === 'nacionalidad'
              ? (b.nacionalidad ?? '').toLocaleLowerCase('es')
              : b.edad;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -1 * sign : av > bv ? 1 * sign : 0;
    });

  const totalActivos = filas.filter((p) => p.activo).length;
  const totalBaja = filas.length - totalActivos;

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
          a un evento desde "Participantes".
        </p>
      </div>

      <div className="rounded-lg border border-borde p-4">
        <h2 className="font-semibold mb-3">Invitar a registrarse (WhatsApp)</h2>
        <InvitarRegistro base={base} />
        <p className="mt-2 text-xs text-tenue">
          Abre WhatsApp con un mensaje y el enlace de registro para que la persona
          cree su propia cuenta.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tenue">
          <strong className="text-texto">{filas.length}</strong> registros ·{' '}
          <span className="text-green-400">{totalActivos}</span> activos
          {totalBaja > 0 && (
            <>
              {' · '}
              <span>{totalBaja}</span> de baja
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/jugadores/importar"
            className="rounded border border-borde text-texto px-3 py-1.5 text-sm hover:border-orange-500"
          >
            Importar CSV
          </Link>
          <a
            href="/admin/jugadores/exportar"
            className="rounded bg-orange-600 text-white px-3 py-1.5 text-sm"
          >
            Exportar a Excel (.csv)
          </a>
        </div>
      </div>

      <TablaJugadores filas={filas} ordenarPor={ordenarPor} direccion={direccion} />
    </div>
  );
}
