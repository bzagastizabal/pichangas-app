// Reporte de pagos con filtros (en revisión / aprobados / rechazados / todos).
// Muestra quién validó y cuándo, y permite ver el comprobante aunque ya esté
// aprobado. Los 'en_revision' se pueden aprobar/rechazar aquí.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { EstadoPago, Pago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { BotonSubmit } from '@/components/BotonSubmit';
import { aprobarPago, rechazarPago } from './actions';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const colorEstado: Record<EstadoPago, string> = {
  en_revision: 'text-sky-400',
  aprobado: 'text-green-400',
  rechazado: 'text-red-400',
};
const etiquetaEstado: Record<EstadoPago, string> = {
  en_revision: 'en revisión',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
};

const filtros = [
  { v: 'en_revision', l: 'En revisión' },
  { v: 'aprobado', l: 'Aprobados' },
  { v: 'rechazado', l: 'Rechazados' },
  { v: 'todos', l: 'Todos' },
];

type PagoFila = Pago & {
  inscripciones: {
    perfiles: { nombre_completo: string | null } | null;
    eventos: { fecha_hora_evento: string; sedes: { nombre: string } | null } | null;
  } | null;
};

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const sp = await searchParams;
  const estado = sp.estado ?? 'en_revision';
  const supabase = await createClient();

  let q = supabase
    .from('pagos')
    .select(
      '*, inscripciones(perfiles(nombre_completo), eventos(fecha_hora_evento, sedes(nombre)))',
    )
    .order('fecha_subida', { ascending: false });
  if (estado !== 'todos') q = q.eq('estado', estado);
  const { data } = await q;
  const pagos = (data as unknown as PagoFila[]) ?? [];

  // Nombres de los administradores que validaron.
  const ids = [...new Set(pagos.map((p) => p.validado_por).filter(Boolean))] as string[];
  let validadores: Record<string, string> = {};
  if (ids.length) {
    const { data: ap } = await supabase.from('perfiles').select('id, nombre_completo').in('id', ids);
    validadores = Object.fromEntries(
      ((ap as { id: string; nombre_completo: string | null }[]) ?? []).map((a) => [
        a.id,
        a.nombre_completo ?? '—',
      ]),
    );
  }

  // URLs firmadas para ver los comprobantes.
  const urls = await Promise.all(
    pagos.map(async (p) => {
      if (!p.url_comprobante || p.comprobante_eliminado) return null;
      const { data: s } = await supabase.storage
        .from('comprobantes')
        .createSignedUrl(p.url_comprobante, 300);
      return s?.signedUrl ?? null;
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pagos</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        {filtros.map((f) => (
          <Link
            key={f.v}
            href={`/admin/pagos?estado=${f.v}`}
            className={`rounded-full px-3 py-1 ${
              estado === f.v ? 'bg-orange-600 text-white' : 'border border-borde text-tenue hover:border-orange-500'
            }`}
          >
            {f.l}
          </Link>
        ))}
      </div>

      {pagos.length === 0 ? (
        <p className="text-tenue">No hay pagos en esta categoría.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full text-sm">
            <thead className="bg-fondo text-left text-tenue">
              <tr>
                <th className="p-3">Jugador</th>
                <th className="p-3">Evento</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Validado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p, i) => (
                <tr key={p.id} className="border-t border-borde align-top">
                  <td className="p-3">
                    <p className="font-medium">{p.inscripciones?.perfiles?.nombre_completo ?? 'Jugador'}</p>
                    <p className="text-xs text-tenue">{formatearFechaLima(p.fecha_subida)}</p>
                  </td>
                  <td className="p-3 text-tenue">
                    {p.inscripciones?.eventos?.sedes?.nombre ?? 'Evento'}
                    {p.inscripciones?.eventos && (
                      <span className="block text-xs">
                        {formatearFechaLima(p.inscripciones.eventos.fecha_hora_evento)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {soles.format(p.monto_declarado)}
                    <span className="block text-xs text-tenue">{p.metodo}</span>
                  </td>
                  <td className={`p-3 ${colorEstado[p.estado]}`}>
                    {etiquetaEstado[p.estado]}
                    {p.estado === 'rechazado' && p.motivo_rechazo && (
                      <span className="block text-xs text-tenue">{p.motivo_rechazo}</span>
                    )}
                  </td>
                  <td className="p-3 text-tenue text-xs">
                    {p.validado_por ? (
                      <>
                        {validadores[p.validado_por] ?? '—'}
                        {p.fecha_validacion && <span className="block">{formatearFechaLima(p.fecha_validacion)}</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col items-end gap-2">
                      {urls[i] ? (
                        <a href={urls[i]!} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                          Ver comprobante
                        </a>
                      ) : (
                        <span className="text-tenue">sin archivo</span>
                      )}
                      {p.estado === 'en_revision' && (
                        <div className="flex flex-col items-end gap-1">
                          <form action={aprobarPago}>
                            <input type="hidden" name="id" value={p.id} />
                            <BotonSubmit
                              className="rounded bg-green-600 px-3 py-1 text-white"
                              pendiente="…"
                            >
                              Aprobar
                            </BotonSubmit>
                          </form>
                          <form action={rechazarPago} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={p.id} />
                            <input
                              name="motivo"
                              placeholder="Motivo"
                              className="w-28 rounded border border-borde bg-campo px-2 py-1 text-texto"
                            />
                            <BotonSubmit
                              className="rounded border border-red-400 px-2 py-1 text-red-400"
                              pendiente="…"
                            >
                              Rechazar
                            </BotonSubmit>
                          </form>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
