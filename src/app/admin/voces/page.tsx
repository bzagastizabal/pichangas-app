// src/app/admin/voces/page.tsx
// Listado de packs de voz del cronómetro (SQL 37). Cada pack es un set de
// audios ("personaje") que reemplaza a la voz sintetizada en los avisos.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RANURAS, type VozPaquete } from '@/lib/voces';
import { BotonSubmit } from '@/components/BotonSubmit';
import { crearPaquete } from './actions';

const input = 'border border-borde p-2 rounded bg-campo text-texto text-sm';

export default async function VocesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('voces_paquetes')
    .select('*')
    .order('created_at', { ascending: false });
  const paquetes = (data as VozPaquete[]) ?? [];

  // Conteo de clips por pack para mostrar el avance de carga.
  const { data: clips } = await supabase.from('voces_clips').select('paquete_id');
  const conteo = new Map<string, number>();
  for (const c of (clips as Array<{ paquete_id: string }> | null) ?? []) {
    conteo.set(c.paquete_id, (conteo.get(c.paquete_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voces del cronómetro</h1>
        <p className="text-sm text-tenue mt-1">
          Sube tus propios audios (un “personaje” por pack) y elígelo en el marcador.
          Los avisos que no tengan audio usan la voz sintetizada del sistema, así que
          puedes empezar con dos o tres archivos.
        </p>
      </div>

      <form
        action={crearPaquete}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-borde p-4"
      >
        <div>
          <label className="block text-xs text-tenue mb-1">Nombre del pack *</label>
          <input name="nombre" className={input} placeholder="p. ej. Relator, Robot, Coach" required />
        </div>
        <div className="grow">
          <label className="block text-xs text-tenue mb-1">Descripción</label>
          <input name="descripcion" className={`${input} w-full`} placeholder="Opcional" />
        </div>
        {/* BotonSubmit evita el doble-click que crea dos packs iguales. */}
        <BotonSubmit
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm"
          pendiente="Creando…"
        >
          Crear pack
        </BotonSubmit>
      </form>

      {paquetes.length === 0 ? (
        <p className="text-sm text-tenue">Todavía no hay packs.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paquetes.map((p) => {
            const n = conteo.get(p.id) ?? 0;
            return (
              <li key={p.id} className="rounded-xl border border-borde p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">🎭 {p.nombre}</p>
                    {p.descripcion && (
                      <p className="text-xs text-tenue truncate">{p.descripcion}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-xs text-tenue">
                    {n}/{RANURAS.length}
                  </span>
                </div>
                <Link
                  href={`/admin/voces/${p.id}`}
                  className="inline-block text-sm text-orange-400 hover:underline"
                >
                  Subir audios →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
