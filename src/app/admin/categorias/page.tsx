import { createClient } from '@/lib/supabase/server';
import type { Categoria } from '@/lib/types';
import {
  alternarActivoCategoria,
  crearCategoria,
  eliminarCategoria,
  guardarRangoCategoria,
} from './actions';

const campo = 'border border-borde rounded px-2 py-1 text-sm bg-campo text-texto';

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('categorias')
    .select('*')
    .order('edad_min', { nullsFirst: false });
  const categorias = (data as Categoria[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <p className="text-sm text-tenue">
        Configuración independiente (LIBRE, M40, M50, Damas…). Puedes definir un
        rango de edad opcional para que la categoría se <strong>sugiera automáticamente</strong>
        a cada jugador a partir de su fecha de nacimiento.
      </p>

      <form action={crearCategoria} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-tenue mb-1">Nombre</label>
          <input name="nombre" placeholder="Sub-15, M40…" required className={campo} />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Edad mín.</label>
          <input name="edad_min" type="number" min="0" max="120" className={`${campo} w-20`} />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Edad máx.</label>
          <input name="edad_max" type="number" min="0" max="120" className={`${campo} w-20`} />
        </div>
        <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded text-sm">
          Agregar
        </button>
      </form>

      <ul className="rounded-lg border border-borde divide-y divide-borde">
        {categorias.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <span>
              <strong>{c.nombre}</strong>
              <span className="ml-2 text-xs text-tenue">
                {c.edad_min == null && c.edad_max == null
                  ? '(sin rango)'
                  : `(${c.edad_min ?? '0'}–${c.edad_max ?? '+'} años)`}
              </span>
              {!c.activo && <span className="ml-2 text-xs text-tenue">(inactiva)</span>}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <form action={guardarRangoCategoria} className="flex items-end gap-1">
                <input type="hidden" name="id" value={c.id} />
                <div>
                  <label className="block text-[10px] text-tenue">mín</label>
                  <input
                    name="edad_min"
                    type="number"
                    min="0"
                    max="120"
                    defaultValue={c.edad_min ?? ''}
                    className={`${campo} w-16`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-tenue">máx</label>
                  <input
                    name="edad_max"
                    type="number"
                    min="0"
                    max="120"
                    defaultValue={c.edad_max ?? ''}
                    className={`${campo} w-16`}
                  />
                </div>
                <button type="submit" className="text-orange-400 hover:underline px-2 py-1">
                  Guardar
                </button>
              </form>
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
