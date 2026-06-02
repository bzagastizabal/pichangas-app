import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/lib/types';
import { urlPublica } from '@/lib/storage';
import { TelefonoInput } from '@/components/TelefonoInput';
import { guardarStaff } from '../../actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export default async function EditarStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const s = data as Staff;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link href="/admin/staff" className="text-sm text-tenue hover:underline">
          ← Staff
        </Link>
        <h1 className="text-2xl font-bold">Editar contacto</h1>
      </div>

      <form action={guardarStaff} encType="multipart/form-data" className="space-y-4">
        <input type="hidden" name="id" value={s.id} />

        <div className="flex items-center gap-4">
          {s.foto_url ? (
            <Image
              src={urlPublica('staff_fotos', s.foto_url)}
              alt={s.nombre}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover border border-borde"
              unoptimized
            />
          ) : (
            <span className="h-24 w-24 inline-flex items-center justify-center rounded-full bg-campo text-tenue text-lg border border-borde">
              {(s.nombre || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-texto mb-1">Foto</label>
            <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            {s.foto_url && (
              <label className="flex items-center gap-2 text-xs text-tenue">
                <input type="checkbox" name="quitar_foto" />
                Quitar la foto actual
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-texto mb-1">Nombre</label>
          <input name="nombre" className={input} defaultValue={s.nombre} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-texto mb-1">Cargo</label>
          <input name="cargo" className={input} defaultValue={s.cargo ?? ''} />
        </div>
        <div>
          <label className="block text-sm font-medium text-texto mb-1">WhatsApp</label>
          <TelefonoInput name="whatsapp" defaultValue={s.whatsapp} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={s.activo} />
          Activo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="es_default" defaultChecked={s.es_default} />
          Contacto por defecto (el que ven los no logueados)
        </label>
        <div className="flex gap-3">
          <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded">
            Guardar
          </button>
          <Link href="/admin/staff" className="px-4 py-2 rounded border border-borde text-texto">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
