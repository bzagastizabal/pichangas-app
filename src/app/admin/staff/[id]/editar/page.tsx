import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/lib/types';
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

      <form action={guardarStaff} className="space-y-4">
        <input type="hidden" name="id" value={s.id} />
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
          <input name="whatsapp" className={input} defaultValue={s.whatsapp ?? ''} />
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
