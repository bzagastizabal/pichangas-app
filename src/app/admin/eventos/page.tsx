// src/app/admin/eventos/page.tsx
// Lista de eventos (pichangas) del admin. Muestra sede, fecha, cupos, costo,
// estado y el enlace público de inscripción.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import type { EstadoEvento, EventoConSede } from '@/lib/types';
import { formatearFechaLima, eventoYaTermino } from '@/lib/fechas';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { CompartirEnlace } from '@/app/admin/CompartirEnlace';
import { cambiarEstadoEvento, eliminarEvento } from './actions';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

const colorEstado: Record<EstadoEvento, string> = {
  abierta: 'bg-green-100 text-green-800',
  cerrada: 'bg-fondo text-texto',
  cancelada: 'bg-red-100 text-red-700',
  finalizada: 'bg-blue-100 text-blue-800',
};

const estados: EstadoEvento[] = ['abierta', 'cerrada', 'cancelada', 'finalizada'];

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from('eventos')
    .select('*, sedes(nombre), evento_arbitros(arbitros(nombre))')
    .order('fecha_hora_evento', { ascending: false });
  const eventos =
    (data as unknown as (EventoConSede & {
      evento_arbitros: { arbitros: { nombre: string } | null }[] | null;
    })[]) ?? [];
  const base = await baseUrl();

  const nombresArbitros = (ev: (typeof eventos)[number]) =>
    (ev.evento_arbitros ?? [])
      .map((x) => x.arbitros?.nombre)
      .filter(Boolean)
      .join(', ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <Link
          href="/admin/eventos/nueva"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          + Nuevo evento
        </Link>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {eventos.length === 0 ? (
        <p className="text-tenue">
          No hay eventos todavía. Crea el primero con “Nuevo evento”.
        </p>
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => (
            <div
              key={ev.id}
              className="rounded-lg border border-borde p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{ev.sedes?.nombre ?? 'Sede ?'}</p>
                  <p className="text-sm text-tenue">
                    {formatearFechaLima(ev.fecha_hora_evento)}
                    {nombresArbitros(ev)
                      ? ` · árbitros: ${nombresArbitros(ev)}`
                      : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${colorEstado[ev.estado]}`}
                >
                  {ev.estado}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-texto">
                <span>Duración: {ev.duracion_horas} h</span>
                <span>Cupos: {ev.cupos_totales}</span>
                <span>Mínimo: {ev.minimo_requerido}</span>
                <span>Por participante: {soles.format(ev.costo_por_participante)}</span>
                <span>Límite pago: {formatearFechaLima(ev.fecha_hora_limite_pago)}</span>
              </div>

              <CompartirEnlace
                url={`${base}/inscribir/${ev.slug_inscripcion}`}
                etiqueta="Inscripción"
                waMensaje={
                  `🏀 Pichanga en ${ev.sedes?.nombre ?? ''} el ` +
                  `${formatearFechaLima(ev.fecha_hora_evento)}. ` +
                  `Inscríbete y reserva tu cupo aquí: ${base}/inscribir/${ev.slug_inscripcion}`
                }
              />

              <div className="flex flex-wrap items-center gap-4 border-t border-borde pt-3">
                {eventoYaTermino(ev.fecha_hora_evento, ev.duracion_horas) ? (
                  <span className="text-sm text-tenue">Realizado (solo lectura)</span>
                ) : (
                  <Link
                    href={`/admin/eventos/${ev.id}/editar`}
                    className="text-sm text-orange-600 hover:underline"
                  >
                    Editar
                  </Link>
                )}
                <Link
                  href={`/admin/eventos/nueva?desde=${ev.id}`}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Copiar
                </Link>
                <Link
                  href={`/admin/eventos/${ev.id}/participantes`}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Participantes
                </Link>

                <form action={cambiarEstadoEvento} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={ev.id} />
                  <select
                    name="estado"
                    defaultValue={ev.estado}
                    className="border border-borde rounded px-2 py-1 text-sm bg-tarjeta text-texto"
                  >
                    {estados.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm text-tenue hover:underline">
                    Cambiar estado
                  </button>
                </form>

                <BotonEliminar
                  action={eliminarEvento}
                  id={ev.id}
                  nombre={`evento en ${ev.sedes?.nombre ?? 'esta sede'}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
