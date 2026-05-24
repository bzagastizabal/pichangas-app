// src/app/admin/arbitros/page.tsx
// Lista de árbitros con crear, editar, activar/desactivar y eliminar.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Arbitro } from '@/lib/types';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { alternarActivoArbitro, eliminarArbitro } from './actions';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

export default async function ArbitrosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from('arbitros')
    .select('*')
    .order('created_at', { ascending: false });
  const arbitros = (data as Arbitro[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Árbitros</h1>
        <Link
          href="/admin/arbitros/nueva"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          + Nuevo árbitro
        </Link>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {arbitros.length === 0 ? (
        <p className="text-gray-500">
          No hay árbitros todavía. Crea el primero con “Nuevo árbitro”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Precio/hora</th>
                <th className="p-3">Tarifa/partido</th>
                <th className="p-3">Calif.</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {arbitros.map((arbitro) => (
                <tr key={arbitro.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{arbitro.nombre}</td>
                  <td className="p-3 text-gray-600">{arbitro.telefono ?? '—'}</td>
                  <td className="p-3 text-gray-600">
                    {soles.format(arbitro.precio_por_hora)}
                  </td>
                  <td className="p-3 text-gray-600">
                    {soles.format(arbitro.tarifa_partido)}
                  </td>
                  <td className="p-3 text-gray-600">
                    {arbitro.calificacion ? `${arbitro.calificacion}★` : '—'}
                  </td>
                  <td className="p-3">
                    {arbitro.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/arbitros/${arbitro.id}/editar`}
                        className="text-orange-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={alternarActivoArbitro}>
                        <input type="hidden" name="id" value={arbitro.id} />
                        <input
                          type="hidden"
                          name="activo"
                          value={String(arbitro.activo)}
                        />
                        <button
                          type="submit"
                          className="text-gray-600 hover:underline"
                        >
                          {arbitro.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                      <BotonEliminar
                        action={eliminarArbitro}
                        id={arbitro.id}
                        nombre={arbitro.nombre}
                      />
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
