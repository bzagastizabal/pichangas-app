import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Categoria } from '@/lib/types';
import { TelefonoInput } from '@/components/TelefonoInput';
import { guardarJugador } from '../../actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export default async function EditarJugadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: perfil }, { data: cats }, { data: pc }] = await Promise.all([
    supabase.from('perfiles').select('id, nombre_completo, dni, telefono, fecha_nacimiento, nacionalidad, activo').eq('id', id).maybeSingle(),
    supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('perfil_categorias').select('categoria_id').eq('perfil_id', id),
  ]);
  if (!perfil) notFound();

  const categorias = (cats as Pick<Categoria, 'id' | 'nombre'>[]) ?? [];
  const actuales = new Set(((pc as { categoria_id: string }[]) ?? []).map((x) => x.categoria_id));

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link href="/admin/jugadores" className="text-sm text-tenue hover:underline">
          ← Jugadores
        </Link>
        <h1 className="text-2xl font-bold">Editar jugador</h1>
      </div>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <form action={guardarJugador} className="space-y-4">
        <input type="hidden" name="id" value={perfil.id} />

        <div>
          <label className="block text-sm font-medium text-texto mb-1">Nombre</label>
          <input name="nombre_completo" className={input} defaultValue={perfil.nombre_completo ?? ''} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1">DNI</label>
          <input name="dni" className={input} defaultValue={perfil.dni ?? ''} />
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1">Teléfono</label>
          <TelefonoInput name="telefono" defaultValue={perfil.telefono} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-texto mb-1">Fecha de nacimiento</label>
            <input
              name="fecha_nacimiento"
              type="date"
              className={input}
              defaultValue={perfil.fecha_nacimiento ?? ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1">Nacionalidad</label>
            <input
              name="nacionalidad"
              className={input}
              defaultValue={perfil.nacionalidad ?? ''}
              placeholder="Peruana"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1">
            Nueva contraseña (opcional)
          </label>
          <input name="password" className={input} placeholder="Déjalo vacío para no cambiarla" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={perfil.activo} />
          Activo (si lo desmarcas, queda dado de baja)
        </label>

        <div>
          <p className="text-sm font-medium text-texto mb-1">Categorías</p>
          {categorias.length === 0 ? (
            <p className="text-xs text-tenue">No hay categorías. Créalas en “Categorías”.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {categorias.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="categorias"
                    value={c.id}
                    defaultChecked={actuales.has(c.id)}
                  />
                  {c.nombre}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded">
            Guardar
          </button>
          <Link href="/admin/jugadores" className="px-4 py-2 rounded border border-borde text-texto">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
