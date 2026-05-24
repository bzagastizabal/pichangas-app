import { createClient } from '@/lib/supabase/server';
import type { Categoria } from '@/lib/types';
import { crearCategoria, alternarActivoCategoria, eliminarCategoria } from './actions';

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre');
  const categorias = (data as Categoria[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <p className="text-sm text-tenue">
        Configuración independiente (LIBRE, M40, M50, Damas…). Se pueden asignar a
        los eventos.
      </p>

      <form action={crearCategoria} className="flex items-center gap-2">
        <input
          name="nombre"
          placeholder="Nueva categoría"
          required
          className="border border-borde rounded px-3 py-2 text-sm bg-campo text-texto"
        />
        <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded text-sm">
          Agregar
        </button>
      </form>

      <ul className="rounded-lg border border-borde divide-y divide-borde">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-3">
            <span>
              {c.nombre}
              {!c.activo && <span className="ml-2 text-xs text-tenue">(inactiva)</span>}
            </span>
            <div className="flex items-center gap-4 text-sm">
              <form action={alternarActivoCategoria}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="activo" value={String(c.activo)} />
                <button type="submit" className="text-tenue hover:underline">
                  {c.activo ? 'Desactivar' : 'Activar'}
                </button>
              </form>
              <form action={eliminarCategoria}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="text-red-400 hover:underline">
                  Eliminar
                </button>
              </form>
            </div>
          </li>
        ))}
        {categorias.length === 0 && (
          <li className="p-3 text-tenue">No hay categorías todavía.</li>
        )}
      </ul>
    </div>
  );
}
