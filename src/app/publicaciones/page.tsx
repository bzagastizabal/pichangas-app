import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Publicacion } from '@/lib/types';
import { urlPublica } from '@/lib/storage';
import { formatearFechaLima } from '@/lib/fechas';

export default async function PublicacionesPage() {
  const { user } = await getSesion();
  if (!user) redirect('/login?next=/publicaciones');

  const supabase = await createClient();
  const { data } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('publicado', true)
    .order('created_at', { ascending: false });
  const publicaciones = (data as Publicacion[]) ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Novedades 🏀</h1>
        <Link href="/dashboard" className="text-sm text-tenue hover:text-orange-600">
          ← Inicio
        </Link>
      </div>

      {publicaciones.length === 0 ? (
        <p className="text-tenue">No hay publicaciones todavía.</p>
      ) : (
        <div className="space-y-6">
          {publicaciones.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-xl border border-borde bg-tarjeta">
              {p.imagenes.length > 0 && (
                <div className={p.imagenes.length === 1 ? '' : 'grid grid-cols-2 gap-1'}>
                  {p.imagenes.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img}
                      src={urlPublica('publicaciones', img)}
                      alt=""
                      loading="lazy"
                      className="h-48 w-full object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="space-y-1 p-4">
                <h2 className="font-semibold">{p.titulo}</h2>
                <p className="text-xs text-tenue">{formatearFechaLima(p.created_at)}</p>
                {p.descripcion && (
                  <p className="whitespace-pre-line text-sm text-texto">{p.descripcion}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
