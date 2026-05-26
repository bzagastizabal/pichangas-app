import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { EstadoEvento, EstadoInscripcion, EstadoPago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { estadoPagoJugador } from '@/lib/estado-pago';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

type EventoFin = {
  id: string;
  fecha_hora_evento: string;
  duracion_horas: number;
  costo_sede: number;
  costo_arbitraje: number;
  cupos_totales: number;
  estado: EstadoEvento;
  sedes: { nombre: string } | null;
};

type InscFin = {
  evento_id: string;
  estado: EstadoInscripcion;
  pagos: { estado: EstadoPago; monto_declarado: number }[];
};

// Balance derivado de un evento y sus inscripciones.
function balance(ev: EventoFin, inscs: InscFin[]) {
  const ingresos = inscs.reduce(
    (acc, i) =>
      acc + i.pagos.filter((p) => p.estado === 'aprobado').reduce((s, p) => s + p.monto_declarado, 0),
    0,
  );
  const egresos = ev.costo_sede + ev.costo_arbitraje;
  const confirmados = inscs.filter((i) => i.estado === 'confirmado').length;
  // Moroso solo si el evento ya terminó y sigue sin pago (antes = pago pendiente).
  const morosos = inscs.filter(
    (i) => estadoPagoJugador(i.estado, i.pagos, ev.fecha_hora_evento, ev.duracion_horas) === 'moroso',
  ).length;
  return { ingresos, egresos, ganancia: ingresos - egresos, confirmados, morosos };
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from('eventos')
    .select('id, fecha_hora_evento, duracion_horas, costo_sede, costo_arbitraje, cupos_totales, estado, sedes(nombre)')
    .order('fecha_hora_evento', { ascending: false });
  if (desde) q = q.gte('fecha_hora_evento', `${desde}T00:00:00-05:00`);
  if (hasta) q = q.lte('fecha_hora_evento', `${hasta}T23:59:59-05:00`);
  const { data: evData } = await q;
  const eventos = (evData as unknown as EventoFin[]) ?? [];

  let inscripciones: InscFin[] = [];
  if (eventos.length > 0) {
    const { data: insData } = await supabase
      .from('inscripciones')
      .select('evento_id, estado, pagos(estado, monto_declarado)')
      .in('evento_id', eventos.map((e) => e.id));
    inscripciones = (insData as unknown as InscFin[]) ?? [];
  }

  const filas = eventos.map((ev) => ({
    ev,
    bal: balance(ev, inscripciones.filter((i) => i.evento_id === ev.id)),
  }));

  const tot = filas.reduce(
    (a, f) => ({
      ingresos: a.ingresos + f.bal.ingresos,
      egresos: a.egresos + f.bal.egresos,
      ganancia: a.ganancia + f.bal.ganancia,
      morosos: a.morosos + f.bal.morosos,
    }),
    { ingresos: 0, egresos: 0, ganancia: 0, morosos: 0 },
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finanzas</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-tenue mb-1">Desde</span>
          <input type="date" name="desde" defaultValue={desde ?? ''} className="border border-borde rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="block text-tenue mb-1">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta ?? ''} className="border border-borde rounded px-2 py-1" />
        </label>
        <button type="submit" className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm">
          Filtrar
        </button>
        {(desde || hasta) && (
          <Link href="/admin/finanzas" className="text-sm text-tenue hover:underline">
            Limpiar
          </Link>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen titulo="Ingresos" valor={soles.format(tot.ingresos)} color="text-green-400" />
        <Resumen titulo="Egresos" valor={soles.format(tot.egresos)} color="text-red-400" />
        <Resumen titulo="Ganancia" valor={soles.format(tot.ganancia)} color="text-orange-400" />
        <Resumen titulo="Morosos" valor={String(tot.morosos)} color="text-texto" />
      </div>

      {filas.length === 0 ? (
        <p className="text-tenue">No hay eventos en el rango seleccionado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full text-sm">
            <thead className="bg-fondo text-left text-tenue">
              <tr>
                <th className="p-3">Evento</th>
                <th className="p-3 text-right">Ingresos</th>
                <th className="p-3 text-right">Egresos</th>
                <th className="p-3 text-right">Ganancia</th>
                <th className="p-3 text-right">Confirm.</th>
                <th className="p-3 text-right">Morosos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ ev, bal }) => (
                <tr key={ev.id} className="border-t border-borde">
                  <td className="p-3">
                    <Link href={`/admin/finanzas/${ev.id}`} className="text-orange-600 hover:underline">
                      {ev.sedes?.nombre ?? 'Evento'}
                    </Link>
                    <div className="text-xs text-tenue">
                      {formatearFechaLima(ev.fecha_hora_evento)}
                    </div>
                  </td>
                  <td className="p-3 text-right text-green-400">{soles.format(bal.ingresos)}</td>
                  <td className="p-3 text-right text-red-400">{soles.format(bal.egresos)}</td>
                  <td className="p-3 text-right font-medium">{soles.format(bal.ganancia)}</td>
                  <td className="p-3 text-right">{bal.confirmados}/{ev.cupos_totales}</td>
                  <td className="p-3 text-right">{bal.morosos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Resumen({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg border border-borde p-4">
      <p className="text-sm text-tenue">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
