import { createClient } from '@/lib/supabase/server';
import type { Publicacion } from '@/lib/types';
import { urlPublica } from '@/lib/storage';
import { formatearFechaLima } from '@/lib/fechas';
import { FormPublicacion } from './FormPublicacion';
import { BotonBorrar } from './BotonBorrar';

type EvFila = { id: string; fecha_hora_evento: string; sedes: { nombre: string } | null };

export default async function AdminPublicacionesPage() {
  const supabase = await createClient();
  const [{ data: pubData }, { data: evData }] = await Promise.all([
    supabase.from('publicaciones').select('*').order('created_at', { ascending: false }),
    supabase
      .from('eventos')
      .select('id, fecha_hora_evento, sedes(nombre)')
      .order('fecha_hora_evento', { ascending: false }),
  ]);
  const publicaciones = (pubData as Publicacion[]) ?? [];
  const eventos = ((evData as unknown as EvFila[]) ?? []).map((e) => ({
    id: e.id,
    nombre: `${e.sedes?.nombre ?? 'Evento'} · ${formatearFechaLima(e.fecha_hora_evento)}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Publicaciones</h1>

      <div className="rounded-lg border border-borde p-4">
        <h2 className="font-semibold mb-3">Nueva publicación</h2>
        <FormPublicacion eventos={eventos} />
      </div>

      <div className="space-y-4">
        {publicaciones.map((p) => (
          <div key={p.id} className="rounded-lg border border-borde p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.titulo}</p>
                <p className="text-xs text-tenue">{formatearFechaLima(p.created_at)}</p>
              </div>
              <BotonBorrar id={p.id} imagenes={p.imagenes} titulo={p.titulo} />
            </div>
            {p.descripcion && <p className="text-sm text-tenue">{p.descripcion}</p>}
            {p.imagenes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.imagenes.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    src={urlPublica('publicaciones', img)}
                    alt=""
                    className="h-24 w-24 rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {publicaciones.length === 0 && <p className="text-tenue">Aún no hay publicaciones.</p>}
      </div>
    </div>
  );
}
