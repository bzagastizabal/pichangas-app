import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import { linkWa } from '@/lib/wa';
import { InvitarRegistro } from '@/app/admin/InvitarRegistro';
import {
  calcularEdad,
  categoriaSugeridaPorEdad,
  type Categoria,
} from '@/lib/types';
import { JugadorForm } from './JugadorForm';
import { BotonReiniciar } from './BotonReiniciar';
import { alternarActivoJugador } from './actions';

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

  const [{ data: perfData }, { data: catsData }] = await Promise.all([
    supabase
      .from('perfiles')
      .select('id, nombre_completo, dni, telefono, fecha_nacimiento, nacionalidad, rol, activo'),
    supabase
      .from('categorias')
      .select('id, nombre, edad_min, edad_max')
      .eq('activo', true)
      .order('edad_min', { nullsFirst: false }),
  ]);
  const perfiles = (perfData as PerfilFila[]) ?? [];
  const categorias =
    (catsData as Pick<Categoria, 'id' | 'nombre' | 'edad_min' | 'edad_max'>[]) ?? [];
  const base = await baseUrl();

  // Orden controlado por query string.
  const ordenarPor: Orden =
    sort === 'edad' || sort === 'dni' || sort === 'nacionalidad' ? sort : 'nombre';
  const direccion: Dir = dir === 'desc' ? 'desc' : 'asc';
  const sign = direccion === 'asc' ? 1 : -1;
  const filas = perfiles
    .map((p) => ({
      ...p,
      edad: calcularEdad(p.fecha_nacimiento),
      categoria: categoriaSugeridaPorEdad(calcularEdad(p.fecha_nacimiento), categorias),
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

  const cabecera = (col: Orden, label: string) => {
    const next = ordenarPor === col && direccion === 'asc' ? 'desc' : 'asc';
    const flecha = ordenarPor === col ? (direccion === 'asc' ? ' ▲' : ' ▼') : '';
    return (
      <Link
        href={`/admin/jugadores?sort=${col}&dir=${next}`}
        className="hover:text-texto"
        scroll={false}
      >
        {label}{flecha}
      </Link>
    );
  };

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
          <strong className="text-texto">{filas.length}</strong> registros ·
          {' '}
          <span className="text-green-400">{totalActivos}</span> activos
          {totalBaja > 0 && <> · <span>{totalBaja}</span> de baja</>}
        </p>
        <a
          href="/admin/jugadores/exportar"
          className="rounded bg-orange-600 text-white px-3 py-1.5 text-sm"
        >
          Exportar a Excel (.csv)
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">{cabecera('nombre', 'Nombre')}</th>
              <th className="p-3">{cabecera('dni', 'DNI')}</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">{cabecera('edad', 'Edad')}</th>
              <th className="p-3">{cabecera('nacionalidad', 'Nacionalidad')}</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id} className={`border-t border-borde ${p.activo ? '' : 'opacity-50'}`}>
                <td className="p-3">{p.nombre_completo ?? '—'}</td>
                <td className="p-3 text-tenue">{p.dni ?? '—'}</td>
                <td className="p-3 text-tenue">
                  {p.telefono ? (
                    <a
                      href={linkWa(
                        p.telefono,
                        `Hola ${p.nombre_completo ?? ''}, te escribo desde el CMT.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:underline"
                    >
                      {p.telefono}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3 text-tenue">{p.edad ?? '—'}</td>
                <td className="p-3 text-tenue">{p.nacionalidad ?? '—'}</td>
                <td className="p-3 text-tenue">{p.categoria?.nombre ?? '—'}</td>
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
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} className="p-3 text-tenue">
                  Aún no hay jugadores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
