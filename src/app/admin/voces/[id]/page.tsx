// src/app/admin/voces/[id]/page.tsx
// Editor de un pack de voz: grilla de ranuras (qué audio suena cuándo) con
// subida individual o masiva, preview y borrado.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { urlPublica } from '@/lib/storage';
import { BUCKET_VOCES, RANURAS, type VozClip, type VozPaquete } from '@/lib/voces';
import { EditorPaquete } from './EditorPaquete';
import { eliminarPaquete, renombrarPaquete } from '../actions';

export default async function PaquetePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('voces_paquetes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const paquete = data as VozPaquete;

  const { data: clipsData } = await supabase
    .from('voces_clips')
    .select('*')
    .eq('paquete_id', id);
  const clips = (clipsData as VozClip[]) ?? [];
  const porClave: Record<string, { id: string; url: string }> = {};
  for (const c of clips) {
    porClave[c.clave] = { id: c.id, url: urlPublica(BUCKET_VOCES, c.path) };
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/voces" className="text-sm text-tenue hover:underline">
          ← Voces
        </Link>
        <h1 className="text-2xl font-bold">🎭 {paquete.nombre}</h1>
        <p className="text-xs text-tenue">
          {clips.length} de {RANURAS.length} audios cargados · lo que falte se dirá con la
          voz del sistema.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-borde p-4">
        <form action={renombrarPaquete} className="flex flex-wrap items-end gap-2 grow">
          <input type="hidden" name="id" value={paquete.id} />
          <div>
            <label className="block text-xs text-tenue mb-1">Nombre</label>
            <input
              name="nombre"
              defaultValue={paquete.nombre}
              className="border border-borde p-2 rounded bg-campo text-texto text-sm"
            />
          </div>
          <div className="grow">
            <label className="block text-xs text-tenue mb-1">Descripción</label>
            <input
              name="descripcion"
              defaultValue={paquete.descripcion ?? ''}
              className="border border-borde p-2 rounded bg-campo text-texto text-sm w-full"
            />
          </div>
          <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded text-sm">
            Guardar
          </button>
        </form>
        <form action={eliminarPaquete}>
          <input type="hidden" name="id" value={paquete.id} />
          <button
            type="submit"
            className="border border-red-500/40 text-red-300 px-4 py-2 rounded text-sm hover:bg-red-500/10"
          >
            Eliminar pack
          </button>
        </form>
      </div>

      <EditorPaquete paqueteId={paquete.id} clipsPorClave={porClave} />
    </div>
  );
}
