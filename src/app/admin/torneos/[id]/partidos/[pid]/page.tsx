// src/app/admin/torneos/[id]/partidos/[pid]/page.tsx
// Detalle del partido: edición rápida, asistencia (jugó / no jugó) por jugador
// del roster, y atajos para registrar el gasto del partido como movimiento.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatearFechaLima } from '@/lib/fechas';
import type { EstadoMovimiento, Movimiento, Partido, Torneo } from '@/lib/types';
import { ETIQUETA_CATEGORIA } from '@/lib/types';
import { actualizarPartido, eliminarPartido, guardarAsistencia } from '../actions';
import { PartidoForm } from '../PartidoForm';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

type Roster = {
  jugador_id: string;
  perfiles: { nombre_completo: string | null; dni: string | null } | null;
};

const colorMov: Record<EstadoMovimiento, string> = {
  pendiente: 'text-amber-400',
  aprobado: 'text-green-400',
  rechazado: 'text-red-400',
};

export default async function PartidoDetallePage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  const supabase = await createClient();

  const [
    { data: torneo },
    { data: partido },
    { data: rosterData },
    { data: asistenciaData },
    { data: movsData },
  ] = await Promise.all([
    supabase.from('torneos').select('id, nombre').eq('id', id).maybeSingle(),
    supabase.from('torneo_partidos').select('*').eq('id', pid).maybeSingle(),
    supabase
      .from('torneo_jugadores')
      .select('jugador_id, perfiles(nombre_completo, dni)')
      .eq('torneo_id', id),
    supabase.from('partido_jugadores').select('jugador_id, jugo').eq('partido_id', pid),
    supabase.from('movimientos').select('*').eq('partido_id', pid).order('fecha', { ascending: false }),
  ]);

  if (!torneo || !partido) notFound();
  const t = torneo as Pick<Torneo, 'id' | 'nombre'>;
  const p = partido as Partido;
  const roster =
    ((rosterData as unknown as Roster[]) ?? []).map((r) => ({
      id: r.jugador_id,
      nombre: r.perfiles?.nombre_completo ?? 'Sin nombre',
      dni: r.perfiles?.dni ?? null,
    }));
  const jugo = new Map(
    ((asistenciaData as { jugador_id: string; jugo: boolean }[]) ?? []).map((a) => [
      a.jugador_id,
      a.jugo,
    ]),
  );
  const movimientos = (movsData as Movimiento[]) ?? [];

  const ingresos = movimientos
    .filter((m) => m.tipo === 'ingreso' && m.estado === 'aprobado')
    .reduce((s, m) => s + Number(m.monto), 0);
  const egresos = movimientos
    .filter((m) => m.tipo === 'egreso' && m.estado === 'aprobado')
    .reduce((s, m) => s + Number(m.monto), 0);
  const balance = ingresos - egresos;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/torneos/${id}`} className="text-sm text-tenue hover:underline">
          ← {t.nombre}
        </Link>
        <h1 className="text-2xl font-bold">
          CMT vs {p.rival}
        </h1>
        <p className="text-sm text-tenue">
          {formatearFechaLima(p.fecha)}
          {p.ubicacion ? ` · ${p.ubicacion}` : ''}
          {p.puntos_propio != null && p.puntos_rival != null && (
            <>
              {' · '}
              <span className="font-semibold text-texto">
                {p.puntos_propio} – {p.puntos_rival}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Editar info del partido */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <h2 className="font-semibold">Editar partido</h2>
        <PartidoForm action={actualizarPartido} torneoId={id} inicial={p} />
        <form action={eliminarPartido}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="torneo_id" value={id} />
          <button
            type="submit"
            className="text-sm text-red-400 hover:underline"
            onClick={(e) => {
              if (!confirm('¿Eliminar este partido y su asistencia?')) e.preventDefault();
            }}
          >
            Eliminar partido
          </button>
        </form>
      </section>

      {/* Asistencia */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Asistencia</h2>
            <p className="text-xs text-tenue">
              Marca quién jugó. Los del roster que no marques quedan como "no jugó".
            </p>
          </div>
          <Link
            href={`/admin/torneos/${id}/roster`}
            className="text-xs text-orange-400 hover:underline"
          >
            Editar roster →
          </Link>
        </div>

        {roster.length === 0 ? (
          <p className="text-sm text-tenue">
            El roster del torneo está vacío.{' '}
            <Link href={`/admin/torneos/${id}/roster`} className="text-orange-400 hover:underline">
              Arma el roster
            </Link>{' '}
            antes de tomar asistencia.
          </p>
        ) : (
          <form action={guardarAsistencia} className="space-y-3">
            <input type="hidden" name="partido_id" value={p.id} />
            <ul className="divide-y divide-borde">
              {roster.map((j) => (
                <li key={j.id}>
                  <label className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="jugo"
                      value={j.id}
                      defaultChecked={jugo.get(j.id) === true}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">
                      <span className="font-medium">{j.nombre}</span>
                      {j.dni && <span className="text-xs text-tenue ml-2">DNI {j.dni}</span>}
                    </span>
                    <input type="hidden" name="roster" value={j.id} />
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="submit"
              className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Guardar asistencia
            </button>
          </form>
        )}
      </section>

      {/* Movimientos del partido */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Gastos / aportes del partido</h2>
          <Link
            href={`/admin/movimientos/nuevo?partido=${pid}&torneo=${id}`}
            className="text-sm text-orange-400 hover:underline"
          >
            + Nuevo movimiento
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card titulo="Ingresos (aprobados)" valor={soles.format(ingresos)} color="text-green-400" />
          <Card titulo="Egresos (aprobados)" valor={soles.format(egresos)} color="text-red-400" />
          <Card
            titulo="Balance del partido"
            valor={soles.format(balance)}
            color={balance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>

        {movimientos.length > 0 && (
          <ul className="divide-y divide-borde text-sm">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>
                  <span className={m.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}>
                    {m.tipo === 'ingreso' ? '↑' : '↓'} {soles.format(Number(m.monto))}
                  </span>
                  <span className="text-tenue"> · {ETIQUETA_CATEGORIA[m.categoria]}</span>
                  {' · '}
                  <span className={colorMov[m.estado]}>{m.estado}</span>
                  <div className="text-xs text-tenue">{m.descripcion}</div>
                </span>
                <Link href="/admin/movimientos" className="text-xs text-tenue hover:underline">
                  Gestionar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-borde p-3">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
