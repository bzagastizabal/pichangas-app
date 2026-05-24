// src/app/admin/pagos/page.tsx
// Panel de aprobación de pagos: lista los comprobantes 'en_revision', muestra
// cada uno (URL firmada temporal) y permite aprobar o rechazar.
// Orden por fecha_subida ascendente: "el que paga primero" aparece primero.
import { createClient } from '@/lib/supabase/server';
import type { Pago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { aprobarPago, rechazarPago } from './actions';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

type PagoAdmin = Pago & {
  inscripciones: {
    usuario_id: string;
    perfiles: { nombre_completo: string | null } | null;
    eventos: {
      fecha_hora_evento: string;
      sedes: { nombre: string } | null;
    } | null;
  } | null;
};

export default async function PagosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pagos')
    .select(
      '*, inscripciones(usuario_id, perfiles(nombre_completo), eventos(fecha_hora_evento, sedes(nombre)))',
    )
    .eq('estado', 'en_revision')
    .order('fecha_subida', { ascending: true });
  const pagos = (data as PagoAdmin[]) ?? [];

  // URL firmada (5 min) por cada comprobante para poder verlo.
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
      <h1 className="text-2xl font-bold">Pagos por revisar</h1>

      {pagos.length === 0 ? (
        <p className="text-tenue">No hay comprobantes pendientes de revisión. 🎉</p>
      ) : (
        <div className="space-y-4">
          {pagos.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-borde p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {p.inscripciones?.perfiles?.nombre_completo ?? 'Jugador'}
                  </p>
                  <p className="text-sm text-tenue">
                    {p.inscripciones?.eventos?.sedes?.nombre ?? 'Evento'} ·{' '}
                    {p.inscripciones?.eventos
                      ? formatearFechaLima(p.inscripciones.eventos.fecha_hora_evento)
                      : ''}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-orange-700">
                    {soles.format(p.monto_declarado)}
                  </p>
                  <p className="text-tenue">{p.metodo}</p>
                </div>
              </div>

              <p className="text-xs text-tenue">
                Subido: {formatearFechaLima(p.fecha_subida)}
              </p>

              {urls[i] ? (
                <a
                  href={urls[i]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-orange-600 hover:underline"
                >
                  Ver comprobante →
                </a>
              ) : (
                <p className="text-sm text-tenue">Sin comprobante adjunto.</p>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-3">
                <form action={aprobarPago}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="bg-green-600 text-white text-sm px-4 py-2 rounded"
                  >
                    Aprobar
                  </button>
                </form>

                <form action={rechazarPago} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="motivo"
                    placeholder="Motivo del rechazo (opcional)"
                    className="border border-borde rounded px-2 py-1 text-sm w-56"
                  />
                  <button
                    type="submit"
                    className="border border-red-300 text-red-600 text-sm px-4 py-2 rounded"
                  >
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
