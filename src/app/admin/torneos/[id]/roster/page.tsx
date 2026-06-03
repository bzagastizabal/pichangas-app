// src/app/admin/torneos/[id]/roster/page.tsx
// Roster picker: lista a todos los jugadores activos, agrupados por
// "Coinciden con la categoría del torneo" vs "Otros". La regla de
// coincidencia es categoriaDelJugador (rango más chico que cubra la edad).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  calcularEdad,
  categoriaDelJugador,
  type Categoria,
  type Torneo,
} from '@/lib/types';
import { guardarRoster } from './actions';

type Perfil = {
  id: string;
  nombre_completo: string | null;
  dni: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
};

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: torneo }, { data: cats }, { data: perfData }, { data: rosterData }] =
    await Promise.all([
      supabase.from('torneos').select('*').eq('id', id).maybeSingle(),
      supabase.from('categorias').select('id, nombre, edad_min, edad_max').eq('activo', true),
      supabase
        .from('perfiles')
        .select('id, nombre_completo, dni, fecha_nacimiento, nacionalidad')
        .eq('activo', true)
        .eq('rol', 'participante')
        .order('nombre_completo'),
      supabase.from('torneo_jugadores').select('jugador_id').eq('torneo_id', id),
    ]);

  if (!torneo) notFound();
  const t = torneo as Torneo;
  const categorias =
    (cats as Pick<Categoria, 'id' | 'nombre' | 'edad_min' | 'edad_max'>[]) ?? [];
  const perfiles = (perfData as Perfil[]) ?? [];
  const enRoster = new Set(
    ((rosterData as { jugador_id: string }[]) ?? []).map((r) => r.jugador_id),
  );

  const filas = perfiles
    .map((p) => {
      const edad = calcularEdad(p.fecha_nacimiento);
      const cat = categoriaDelJugador(edad, categorias);
      return {
        ...p,
        edad,
        categoria_id: cat?.id ?? null,
        categoria_nombre: cat?.nombre ?? null,
        en_roster: enRoster.has(p.id),
      };
    })
    .sort((a, b) =>
      (a.nombre_completo ?? '').localeCompare(b.nombre_completo ?? '', 'es'),
    );

  const calzan = filas.filter((f) => f.categoria_id === t.categoria_id && t.categoria_id);
  const otros = filas.filter((f) => f.categoria_id !== t.categoria_id || !t.categoria_id);

  const catNombre =
    categorias.find((c) => c.id === t.categoria_id)?.nombre ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/torneos/${id}`} className="text-sm text-tenue hover:underline">
          ← {t.nombre}
        </Link>
        <h1 className="text-2xl font-bold">Roster del torneo</h1>
        <p className="text-sm text-tenue mt-1">
          {catNombre
            ? <>Categoría del torneo: <strong className="text-texto">{catNombre}</strong>. Aparecen primero los jugadores cuya categoría por edad coincide.</>
            : 'El torneo no tiene categoría asignada; aparecen todos los jugadores activos en orden alfabético.'}
        </p>
      </div>

      <form action={guardarRoster} className="space-y-5">
        <input type="hidden" name="torneo_id" value={id} />

        {catNombre && calzan.length > 0 && (
          <Seccion
            titulo={`Coinciden con ${catNombre}`}
            sub={`${calzan.length} jugadores`}
            filas={calzan}
            destacar
          />
        )}

        <Seccion
          titulo={catNombre ? 'Otros jugadores' : 'Jugadores'}
          sub={`${otros.length} jugadores`}
          filas={otros}
        />

        <div className="flex gap-3 sticky bottom-2 z-10 bg-fondo/95 backdrop-blur p-3 rounded-lg border border-borde">
          <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded font-medium">
            Guardar roster
          </button>
          <Link
            href={`/admin/torneos/${id}`}
            className="px-4 py-2 rounded border border-borde text-texto"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Seccion({
  titulo,
  sub,
  filas,
  destacar = false,
}: {
  titulo: string;
  sub: string;
  filas: {
    id: string;
    nombre_completo: string | null;
    dni: string | null;
    edad: number | null;
    nacionalidad: string | null;
    categoria_nombre: string | null;
    en_roster: boolean;
  }[];
  destacar?: boolean;
}) {
  if (filas.length === 0) return null;
  return (
    <section
      className={`rounded-lg border p-3 space-y-1 ${
        destacar ? 'border-orange-500/40 bg-orange-500/5' : 'border-borde'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{titulo}</h2>
        <span className="text-xs text-tenue">{sub}</span>
      </div>
      <ul className="divide-y divide-borde">
        {filas.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                name="jugador"
                value={p.id}
                defaultChecked={p.en_roster}
                className="h-4 w-4"
              />
              <span className="flex-1">
                <span className="font-medium">{p.nombre_completo ?? 'Sin nombre'}</span>
                <span className="text-xs text-tenue ml-2">
                  {p.edad != null ? `${p.edad} años` : 'sin edad'}
                  {p.nacionalidad ? ` · ${p.nacionalidad}` : ''}
                  {p.dni ? ` · DNI ${p.dni}` : ''}
                </span>
              </span>
              {p.categoria_nombre && (
                <span className="text-xs text-tenue">{p.categoria_nombre}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
