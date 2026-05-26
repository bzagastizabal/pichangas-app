import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoInscripcion,
  EstadoMovimiento,
  EstadoPago,
  Egreso,
  Evento,
  Movimiento,
} from '@/lib/types';
import { ETIQUETA_CATEGORIA } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { estadoPagoJugador, type EstadoPagoJugador } from '@/lib/estado-pago';
import { registrarEgreso, eliminarEgreso } from './actions';

const etiquetaPago: Record<EstadoPagoJugador, string> = {
  pagado: 'pagado',
  en_revision: 'en revisión',
  pendiente: 'pago pendiente',
  moroso: 'moroso',
};

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

type EventoDet = Evento & { sedes: { nombre: string } | null; arbitros: { nombre: string } | null };

type InscDet = {
  id: string;
  estado: EstadoInscripcion;
  fecha_reserva: string;
  perfiles: { nombre_completo: string | null; telefono: string | null } | null;
  pagos: { estado: EstadoPago; monto_declarado: number; fecha_subida: string }[];
};

const colorEstado: Record<EstadoInscripcion, string> = {
  pendiente: 'text-amber-400',
  confirmado: 'text-green-400',
  lista_espera: 'text-sky-400',
  expirado: 'text-tenue',
  liberado: 'text-tenue',
};

const colorMov: Record<EstadoMovimiento, string> = {
  pendiente: 'text-amber-400',
  aprobado: 'text-green-400',
  rechazado: 'text-red-400',
};

const campo = 'border border-borde rounded px-2 py-1.5 text-sm bg-campo text-texto';

export default async function FinanzaEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ev } = await supabase
    .from('eventos')
    // FK explícita: 'arbitros' es ambiguo desde que existe la tabla puente
    // evento_arbitros (multi-árbitro). Aquí basta con el legacy (primer árbitro).
    .select('*, sedes(nombre), arbitros!eventos_arbitro_id_fkey(nombre)')
    .eq('id', id)
    .maybeSingle();
  if (!ev) notFound();
  const evento = ev as EventoDet;

  const { data: insData } = await supabase
    .from('inscripciones')
    .select('id, estado, fecha_reserva, perfiles(nombre_completo, telefono), pagos(estado, monto_declarado, fecha_subida)')
    .eq('evento_id', id)
    .order('fecha_reserva', { ascending: true });
  const inscritos = (insData as unknown as InscDet[]) ?? [];

  const { data: egData } = await supabase
    .from('egresos')
    .select('*')
    .eq('evento_id', id)
    .order('fecha_pago', { ascending: false });
  const egresos = (egData as Egreso[]) ?? [];

  // Movimientos vinculados a este evento (donaciones, gastos extra, etc.).
  const { data: movData } = await supabase
    .from('movimientos')
    .select('*')
    .eq('evento_id', id)
    .order('fecha', { ascending: false });
  const movimientos = (movData as Movimiento[]) ?? [];

  const ingresosCuotas = inscritos.reduce(
    (acc, i) => acc + i.pagos.filter((p) => p.estado === 'aprobado').reduce((s, p) => s + p.monto_declarado, 0),
    0,
  );
  const movAprobados = movimientos.filter((m) => m.estado === 'aprobado');
  const ingresosExtra = movAprobados
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const egresosExtra = movAprobados
    .filter((m) => m.tipo === 'egreso')
    .reduce((s, m) => s + Number(m.monto), 0);
  const ingresos = ingresosCuotas + ingresosExtra;
  const egresoEstimado = evento.costo_sede + evento.costo_arbitraje;
  const egresosTotales = egresoEstimado + egresosExtra;
  const gananciaNeta = ingresos - egresosTotales;
  const egresoPagado = egresos.reduce((s, e) => s + e.monto, 0);
  const movPendientes = movimientos.filter((m) => m.estado === 'pendiente').length;
  const estadoPago = (i: InscDet) =>
    estadoPagoJugador(i.estado, i.pagos, evento.fecha_hora_evento, evento.duracion_horas);
  const esMoroso = (i: InscDet) => estadoPago(i) === 'moroso';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/finanzas" className="text-sm text-tenue hover:underline">
          ← Finanzas
        </Link>
        <h1 className="text-2xl font-bold">{evento.sedes?.nombre ?? 'Evento'}</h1>
        <p className="text-sm text-tenue">{formatearFechaLima(evento.fecha_hora_evento)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen titulo="Ingresos totales" valor={soles.format(ingresos)} color="text-green-400" />
        <Resumen titulo="Egresos totales" valor={soles.format(egresosTotales)} color="text-red-400" />
        <Resumen
          titulo="Ganancia neta"
          valor={soles.format(gananciaNeta)}
          color={gananciaNeta >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <Resumen titulo="Egreso pagado" valor={soles.format(egresoPagado)} color="text-tenue" />
      </div>

      {/* Desglose por origen del balance del evento. */}
      <div className="rounded-lg border border-borde p-4 text-sm space-y-1">
        <p className="font-medium">Desglose</p>
        <p className="text-tenue">
          <span className="text-texto">Ingresos:</span>{' '}
          cuotas <span className="text-green-400">+{soles.format(ingresosCuotas)}</span>
          {' · '}
          extras <span className="text-green-400">+{soles.format(ingresosExtra)}</span>
        </p>
        <p className="text-tenue">
          <span className="text-texto">Egresos:</span>{' '}
          sede + arbitraje <span className="text-red-400">−{soles.format(egresoEstimado)}</span>
          {' · '}
          extras <span className="text-red-400">−{soles.format(egresosExtra)}</span>
        </p>
        {movPendientes > 0 && (
          <p className="text-amber-400">
            ⚠️ {movPendientes} movimiento(s) pendiente(s) de aprobación: aún no cuentan.
          </p>
        )}
      </div>

      {/* Pagos a sede / árbitro */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <h2 className="font-semibold">Pagos a sede y árbitro</h2>
        <form action={registrarEgreso} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="evento_id" value={evento.id} />
          <select name="tipo" defaultValue="sede" className={campo}>
            <option value="sede">Sede{evento.sedes?.nombre ? ` (${evento.sedes.nombre})` : ''}</option>
            <option value="arbitro">Árbitro{evento.arbitros?.nombre ? ` (${evento.arbitros.nombre})` : ''}</option>
            <option value="otro">Otro</option>
          </select>
          <input name="monto" type="number" min="0" step="0.01" placeholder="Monto" className={`${campo} w-28`} required />
          <select name="metodo" defaultValue="efectivo" className={campo}>
            <option value="efectivo">Efectivo</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="banco">Banco</option>
          </select>
          <input name="fecha_pago" type="date" className={campo} />
          <input name="nota" placeholder="Nota (opcional)" className={`${campo} w-40`} />
          <button type="submit" className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm">
            Registrar pago
          </button>
        </form>

        {egresos.length > 0 && (
          <ul className="divide-y divide-borde text-sm">
            {egresos.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="capitalize">{e.tipo}</span> · {soles.format(e.monto)}
                  {e.metodo ? ` · ${e.metodo}` : ''}
                  <span className="text-tenue"> · {formatearFechaLima(e.fecha_pago)}</span>
                  {e.nota ? <span className="text-tenue"> · {e.nota}</span> : ''}
                </span>
                <form action={eliminarEgreso}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="text-red-400 hover:underline">Eliminar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Movimientos vinculados (donaciones, gastos extras, etc.). */}
      <section className="rounded-lg border border-borde p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Movimientos del evento</h2>
          <Link
            href={`/admin/movimientos/nuevo?evento=${evento.id}`}
            className="text-sm text-orange-400 hover:underline"
          >
            + Nuevo movimiento
          </Link>
        </div>
        {movimientos.length === 0 ? (
          <p className="text-sm text-tenue">
            Sin movimientos vinculados todavía. Puedes registrar aquí donaciones
            recibidas o gastos extras de este evento.
          </p>
        ) : (
          <ul className="divide-y divide-borde text-sm">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>
                  <span className={m.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}>
                    {m.tipo === 'ingreso' ? '↑' : '↓'} {soles.format(Number(m.monto))}
                  </span>
                  <span className="text-tenue"> · {ETIQUETA_CATEGORIA[m.categoria]}</span>
                  <span className="text-tenue"> · {formatearFechaLima(m.fecha)}</span>
                  {' · '}
                  <span className={colorMov[m.estado]}>{m.estado}</span>
                  <div className="text-xs text-tenue">{m.descripcion}</div>
                </span>
                <Link
                  href="/admin/movimientos"
                  className="text-xs text-tenue hover:underline"
                >
                  Gestionar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">Jugador</th>
              <th className="p-3">Inscripción</th>
              <th className="p-3">Pago</th>
              <th className="p-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {inscritos.map((i) => {
              const aprobado = i.pagos.find((p) => p.estado === 'aprobado');
              return (
                <tr key={i.id} className={`border-t border-borde ${esMoroso(i) ? 'bg-red-500/10' : ''}`}>
                  <td className="p-3">
                    {i.perfiles?.nombre_completo ?? 'Jugador'}
                    {esMoroso(i) && <span className="ml-2 text-xs text-red-400">moroso</span>}
                    {i.perfiles?.telefono && (
                      <div className="text-xs text-tenue">{i.perfiles.telefono}</div>
                    )}
                  </td>
                  <td className={`p-3 ${colorEstado[i.estado]}`}>{i.estado}</td>
                  <td className="p-3 text-tenue">{etiquetaPago[estadoPago(i)]}</td>
                  <td className="p-3 text-right">
                    {aprobado ? soles.format(aprobado.monto_declarado) : '—'}
                  </td>
                </tr>
              );
            })}
            {inscritos.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-tenue">
                  Aún no hay inscritos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
