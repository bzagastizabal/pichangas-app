// src/app/admin/eventos/page.tsx
// Lista de eventos (pichangas) del admin. Muestra sede, fecha, cupos, costo,
// estado y el enlace público de inscripción.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { EstadoEvento, EventoConSede } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { cambiarEstadoEvento, eliminarEvento } from './actions';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

const colorEstado: Record<EstadoEvento, string> = {
  abierta: 'bg-green-100 text-green-800',
  cerrada: 'bg-gray-100 text-gray-700',
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
    .select('*, sedes(nombre), arbitros(nombre)')
    .order('fecha_hora_evento', { ascending: false });
  const eventos = (data as EventoConSede[]) ?? [];

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
        <p className="text-gray-500">
          No hay eventos todavía. Crea el primero con “Nuevo evento”.
        </p>
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => (
            <div
              key={ev.id}
              className="rounded-lg border border-gray-200 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{ev.sedes?.nombre ?? 'Sede ?'}</p>
                  <p className="text-sm text-gray-600">
                    {formatearFechaLima(ev.fecha_hora_evento)}
                    {ev.arbitros?.nombre ? ` · árbitro: ${ev.arbitros.nombre}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${colorEstado[ev.estado]}`}
                >
                  {ev.estado}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                <span>Duración: {ev.duracion_horas} h</span>
                <span>Cupos: {ev.cupos_totales}</span>
                <span>Mínimo: {ev.minimo_requerido}</span>
                <span>Por participante: {soles.format(ev.costo_por_participante)}</span>
                <span>Límite pago: {formatearFechaLima(ev.fecha_hora_limite_pago)}</span>
              </div>

              <p className="text-xs text-gray-500">
                Enlace de inscripción:{' '}
                <code className="bg-gray-100 px-1 rounded">
                  /inscribir/{ev.slug_inscripcion}
                </code>{' '}
                <span className="text-gray-400">(página pública: próximo paso)</span>
              </p>

              <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                <Link
                  href={`/admin/eventos/${ev.id}/editar`}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Editar
                </Link>

                <form action={cambiarEstadoEvento} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={ev.id} />
                  <select
                    name="estado"
                    defaultValue={ev.estado}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {estados.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm text-gray-600 hover:underline">
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
