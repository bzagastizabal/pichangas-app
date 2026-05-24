// src/app/admin/sedes/page.tsx
// Lista de sedes (admin ve todas vía RLS). Permite crear, editar, activar/
// desactivar y eliminar.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Sede } from '@/lib/types';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { alternarActivoSede, eliminarSede } from './actions';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

export default async function SedesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from('sedes')
    .select('*')
    .order('created_at', { ascending: false });
  const sedes = (data as Sede[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sedes</h1>
        <Link
          href="/admin/sedes/nueva"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
        >
          + Nueva sede
        </Link>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {sedes.length === 0 ? (
        <p className="text-gray-500">
          No hay sedes todavía. Crea la primera con “Nueva sede”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Dirección</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Precio/hora</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map((sede) => (
                <tr key={sede.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{sede.nombre}</td>
                  <td className="p-3 text-gray-600">{sede.direccion ?? '—'}</td>
                  <td className="p-3 text-gray-600">
                    {sede.telefono_contacto ?? '—'}
                  </td>
                  <td className="p-3 text-gray-600">
                    {soles.format(sede.precio_por_hora)}
                  </td>
                  <td className="p-3">
                    {sede.activo ? (
                      <span className="text-green-700">Activa</span>
                    ) : (
                      <span className="text-gray-400">Inactiva</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/sedes/${sede.id}/editar`}
                        className="text-orange-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={alternarActivoSede}>
                        <input type="hidden" name="id" value={sede.id} />
                        <input
                          type="hidden"
                          name="activo"
                          value={String(sede.activo)}
                        />
                        <button
                          type="submit"
                          className="text-gray-600 hover:underline"
                        >
                          {sede.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                      <BotonEliminar
                        action={eliminarSede}
                        id={sede.id}
                        nombre={sede.nombre}
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
