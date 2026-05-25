import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Staff } from '@/lib/types';
import {
  crearStaff,
  marcarDefault,
  alternarActivoStaff,
  eliminarStaff,
} from './actions';

const input = 'border border-borde p-2 rounded bg-campo text-texto text-sm';

export default async function StaffPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('staff').select('*').order('orden').order('nombre');
  const staff = (data as Staff[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Staff</h1>
      <p className="text-sm text-tenue">
        Contactos que ven los usuarios. Los logueados ven todos; los no logueados,
        solo el marcado “por defecto”.
      </p>

      <form action={crearStaff} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde p-4">
        <div>
          <label className="block text-xs text-tenue mb-1">Nombre *</label>
          <input name="nombre" className={input} required />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Cargo</label>
          <input name="cargo" className={input} placeholder="p. ej. Tesorero" />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">WhatsApp</label>
          <input name="whatsapp" className={input} placeholder="999 999 999" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="es_default" />
          Por defecto
        </label>
        <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded text-sm">
          Agregar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Cargo</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Default</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={`border-t border-borde ${s.activo ? '' : 'opacity-50'}`}>
                <td className="p-3">{s.nombre}</td>
                <td className="p-3 text-tenue">{s.cargo ?? '—'}</td>
                <td className="p-3 text-tenue">{s.whatsapp ?? '—'}</td>
                <td className="p-3">{s.es_default ? <span className="text-orange-500">★</span> : ''}</td>
                <td className="p-3">
                  {s.activo ? (
                    <span className="text-green-400">activo</span>
                  ) : (
                    <span className="text-tenue">inactivo</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-4">
                    <Link href={`/admin/staff/${s.id}/editar`} className="text-orange-600 hover:underline">
                      Editar
                    </Link>
                    {!s.es_default && (
                      <form action={marcarDefault}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="text-tenue hover:underline">
                          Hacer default
                        </button>
                      </form>
                    )}
                    <form action={alternarActivoStaff}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="activo" value={String(s.activo)} />
                      <button type="submit" className="text-tenue hover:underline">
                        {s.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <form action={eliminarStaff}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-red-400 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-tenue">
                  No hay contactos. Agrega uno arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
