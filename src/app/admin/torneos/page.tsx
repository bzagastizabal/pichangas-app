// src/app/admin/torneos/page.tsx
// Lista de torneos en los que el club participa o ha participado.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { EstadoTorneo, Torneo } from '@/lib/types';

const colorEstado: Record<EstadoTorneo, string> = {
  convocados: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  inscritos: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  en_curso: 'bg-green-500/15 text-green-300 ring-green-500/30',
  finalizado: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  cancelado: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

const etiquetaEstado: Record<EstadoTorneo, string> = {
  convocados: 'Convocados',
  inscritos: 'Inscritos',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

type Fila = Torneo & { categorias: { nombre: string } | null };

function rango(t: Torneo): string {
  const ini = t.fecha_inicio
    ? new Date(t.fecha_inicio).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const fin = t.fecha_fin
    ? new Date(t.fecha_fin).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  return fin && fin !== ini ? `${ini} – ${fin}` : ini;
}

export default async function TorneosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('torneos')
    .select('*, categorias(nombre)')
    .order('fecha_inicio', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  const torneos = (data as unknown as Fila[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Torneos</h1>
        <Link
          href="/admin/torneos/nuevo"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          + Nuevo torneo
        </Link>
      </div>

      <p className="text-sm text-tenue">
        Lleva el control de los torneos donde participa el club: roster, fechas,
        asistencia por partido, gastos de inscripción y aportes. Cada gasto se
        registra como <Link href="/admin/movimientos" className="text-orange-400 hover:underline">movimiento</Link>{' '}
        vinculado al torneo, así suma al balance global.
      </p>

      {torneos.length === 0 ? (
        <p className="text-tenue">No hay torneos todavía. Crea el primero con "+ Nuevo torneo".</p>
      ) : (
        <div className="space-y-3">
          {torneos.map((t) => (
            <Link
              key={t.id}
              href={`/admin/torneos/${t.id}`}
              className="block rounded-lg border border-borde p-4 hover:border-orange-500"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.nombre}</p>
                  <p className="text-xs text-tenue">
                    {rango(t)}
                    {t.organizador ? ` · ${t.organizador}` : ''}
                    {t.categorias?.nombre ? ` · ${t.categorias.nombre}` : ''}
                    {t.ubicacion ? ` · ${t.ubicacion}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${colorEstado[t.estado]}`}
                  >
                    {etiquetaEstado[t.estado]}
                  </span>
                  {t.posicion_final && (
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-orange-500/30">
                      🏆 {t.posicion_final}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
