// src/app/admin/torneos/[id]/page.tsx
// Hub del torneo: info + roster + tabla de partidos + balance financiero +
// resumen de asistencia por jugador del roster.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatearFechaLima } from '@/lib/fechas';
import type {
  EstadoPartido,
  EstadoTorneo,
  Movimiento,
  Partido,
  Torneo,
} from '@/lib/types';
import { eliminarTorneo } from '../actions';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const etiquetaEstadoTorneo: Record<EstadoTorneo, string> = {
  convocados: 'Convocados',
  inscritos: 'Inscritos',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const etiquetaEstadoPartido: Record<EstadoPartido, string> = {
  programado: 'Programado',
  jugado: 'Jugado',
  wo: 'W.O.',
  aplazado: 'Aplazado',
  cancelado: 'Cancelado',
};

const colorEstadoPartido: Record<EstadoPartido, string> = {
  programado: 'text-amber-300',
  jugado: 'text-green-300',
  wo: 'text-sky-300',
  aplazado: 'text-zinc-400',
  cancelado: 'text-red-300',
};

type Roster = {
  jugador_id: string;
  perfiles: { nombre_completo: string | null } | null;
};

type Asistencia = {
  partido_id: string;
  jugador_id: string;
  jugo: boolean;
};

export default async function TorneoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: torneo },
    { data: roster },
    { data: partidosData },
    { data: asistencias },
    { data: movs },
  ] = await Promise.all([
    supabase
      .from('torneos')
      .select('*, categorias(nombre)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('torneo_jugadores')
      .select('jugador_id, perfiles(nombre_completo)')
      .eq('torneo_id', id),
    supabase
      .from('torneo_partidos')
      .select('*')
      .eq('torneo_id', id)
      .order('fecha', { ascending: true }),
    supabase
      .from('partido_jugadores')
      .select('partido_id, jugador_id, jugo')
      .in(
        'partido_id',
        (
          await supabase
            .from('torneo_partidos')
            .select('id')
            .eq('torneo_id', id)
        ).data?.map((x: { id: string }) => x.id) ?? [],
      ),
    supabase
      .from('movimientos')
      .select('*')
      .eq('torneo_id', id),
  ]);

  if (!torneo) notFound();
  const t = torneo as Torneo & { categorias: { nombre: string } | null };
  const partidos = (partidosData as Partido[]) ?? [];
  const asistenciasL = (asistencias as Asistencia[]) ?? [];
  const movimientos = (movs as Movimiento[]) ?? [];
  const rosterL = ((roster as unknown as Roster[]) ?? []).map((r) => ({
    id: r.jugador_id,
    nombre: r.perfiles?.nombre_completo ?? 'Sin nombre',
  }));

  // Balance financiero (movimientos aprobados vinculados al torneo o a sus
  // partidos).
  const aprobados = movimientos.filter((m) => m.estado === 'aprobado');
  const ingresos = aprobados
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const egresos = aprobados
    .filter((m) => m.tipo === 'egreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const balance = ingresos - egresos;
  const pendientes = movimientos.filter((m) => m.estado === 'pendiente').length;

  // Récord W-L (partidos jugados con marcadores).
  const conMarcador = partidos.filter(
    (p) => p.estado === 'jugado' && p.puntos_propio != null && p.puntos_rival != null,
  );
  const ganados = conMarcador.filter((p) => (p.puntos_propio ?? 0) > (p.puntos_rival ?? 0)).length;
  const perdidos = conMarcador.filter((p) => (p.puntos_propio ?? 0) < (p.puntos_rival ?? 0)).length;
  const empatados = conMarcador.filter(
    (p) => (p.puntos_propio ?? 0) === (p.puntos_rival ?? 0),
  ).length;

  // Asistencia acumulada por jugador del roster.
  const partidosJugados = new Set(
    partidos.filter((p) => p.estado === 'jugado' || p.estado === 'wo').map((p) => p.id),
  );
  const totalJugados = partidosJugados.size;
  const conteo = new Map<string, number>();
  for (const a of asistenciasL) {
    if (a.jugo && partidosJugados.has(a.partido_id)) {
      conteo.set(a.jugador_id, (conteo.get(a.jugador_id) ?? 0) + 1);
    }
  }
  const asistenciaPorJugador = rosterL
    .map((j) => ({ ...j, jugados: conteo.get(j.id) ?? 0 }))
    .sort((a, b) => b.jugados - a.jugados || a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href="/admin/torneos" className="text-sm text-tenue hover:underline">
            ← Torneos
          </Link>
          <h1 className="text-2xl font-bold">{t.nombre}</h1>
          <p className="text-sm text-tenue">
            {etiquetaEstadoTorneo[t.estado]}
            {t.organizador ? ` · ${t.organizador}` : ''}
            {t.categorias?.nombre ? ` · ${t.categorias.nombre}` : ''}
            {t.fecha_inicio && (
              <> · {t.fecha_inicio}{t.fecha_fin && t.fecha_fin !== t.fecha_inicio ? ` → ${t.fecha_fin}` : ''}</>
            )}
            {t.ubicacion ? ` · ${t.ubicacion}` : ''}
          </p>
          {t.posicion_final && (
            <p className="mt-1 inline-block rounded-full bg-orange-500/15 px-3 py-0.5 text-sm font-bold text-orange-300 ring-1 ring-orange-500/30">
              🏆 {t.posicion_final}
            </p>
          )}
          {t.notas && <p className="mt-2 text-sm text-tenue whitespace-pre-line">{t.notas}</p>}
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/admin/torneos/${id}/editar`} className="text-orange-400 hover:underline">
            Editar
          </Link>
          <form action={eliminarTorneo}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="text-red-400 hover:underline"
              onClick={(e) => {
                if (!confirm('¿Eliminar este torneo y todos sus partidos y asistencia?')) {
                  e.preventDefault();
                }
              }}
            >
              Eliminar
            </button>
          </form>
        </div>
      </div>

      {/* Roster */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Roster</h2>
            <p className="text-xs text-tenue">{rosterL.length} jugadores convocados</p>
          </div>
          <Link
            href={`/admin/torneos/${id}/roster`}
            className="text-sm text-orange-400 hover:underline"
          >
            Editar roster →
          </Link>
        </div>
        {rosterL.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rosterL.map((j) => (
              <span
                key={j.id}
                className="rounded-full bg-tarjeta/60 ring-1 ring-white/10 px-3 py-1 text-xs"
              >
                {j.nombre}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Partidos */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Partidos</h2>
            <p className="text-xs text-tenue">
              {conMarcador.length > 0
                ? `Récord ${ganados}–${perdidos}${empatados > 0 ? `–${empatados}` : ''}`
                : 'Sin partidos jugados aún'}
            </p>
          </div>
          <Link
            href={`/admin/torneos/${id}/partidos/nuevo`}
            className="text-sm text-orange-400 hover:underline"
          >
            + Nuevo partido
          </Link>
        </div>
        {partidos.length === 0 ? (
          <p className="text-sm text-tenue">No hay partidos cargados.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {partidos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/torneos/${id}/partidos/${p.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:bg-white/5 rounded px-2"
                >
                  <span>
                    <span className="font-medium">CMT vs {p.rival}</span>
                    <span className="text-xs text-tenue ml-2">
                      {formatearFechaLima(p.fecha)}
                      {p.ubicacion ? ` · ${p.ubicacion}` : ''}
                    </span>
                  </span>
                  <span className="text-sm flex items-center gap-3">
                    {p.puntos_propio != null && p.puntos_rival != null && (
                      <span className="font-mono font-semibold text-texto">
                        {p.puntos_propio} – {p.puntos_rival}
                      </span>
                    )}
                    <span className={colorEstadoPartido[p.estado]}>
                      {etiquetaEstadoPartido[p.estado]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Finanzas del torneo */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Balance del torneo</h2>
            <p className="text-xs text-tenue">
              Movimientos aprobados vinculados al torneo o a sus partidos.
            </p>
          </div>
          <Link
            href={`/admin/movimientos/nuevo?torneo=${id}`}
            className="text-sm text-orange-400 hover:underline"
          >
            + Nuevo movimiento
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card titulo="Ingresos" valor={soles.format(ingresos)} color="text-green-400" />
          <Card titulo="Egresos" valor={soles.format(egresos)} color="text-red-400" />
          <Card
            titulo="Balance"
            valor={soles.format(balance)}
            color={balance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
        {pendientes > 0 && (
          <p className="text-xs text-amber-300">
            ⚠️ {pendientes} movimiento(s) pendientes de aprobación; aún no cuentan.
          </p>
        )}
      </section>

      {/* Asistencia acumulada */}
      {rosterL.length > 0 && totalJugados > 0 && (
        <section className="rounded-lg border border-borde p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Asistencia acumulada</h2>
            <p className="text-xs text-tenue">
              Partidos jugados / W.O. del club: {totalJugados}
            </p>
          </div>
          <div className="overflow-x-auto rounded border border-borde">
            <table className="w-full text-sm">
              <thead className="bg-fondo text-left text-tenue">
                <tr>
                  <th className="p-3">Jugador</th>
                  <th className="p-3 text-right">Jugados</th>
                  <th className="p-3 text-right">No jugados</th>
                </tr>
              </thead>
              <tbody>
                {asistenciaPorJugador.map((a) => (
                  <tr key={a.id} className="border-t border-borde">
                    <td className="p-3">{a.nombre}</td>
                    <td className="p-3 text-right text-green-400">{a.jugados}</td>
                    <td className="p-3 text-right text-tenue">{totalJugados - a.jugados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
