// src/app/admin/sedes/SedeForm.tsx
// Formulario compartido para crear y editar sedes. La Server Action llega como
// prop; con useActionState mostramos estado de envío y errores.
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { EstadoForm, Sede } from '@/lib/types';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

export function SedeForm({
  action,
  inicial,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial?: Sede;
}) {
  const [estado, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <div>
        <label className={label} htmlFor="nombre">
          Nombre *
        </label>
        <input
          id="nombre"
          name="nombre"
          className={input}
          defaultValue={inicial?.nombre ?? ''}
          required
          placeholder="Cancha Los Olivos"
        />
      </div>

      <div>
        <label className={label} htmlFor="direccion">
          Dirección
        </label>
        <input
          id="direccion"
          name="direccion"
          className={input}
          defaultValue={inicial?.direccion ?? ''}
          placeholder="Av. Principal 123"
        />
      </div>

      <div>
        <label className={label} htmlFor="geolocalizacion">
          Ubicación (link de Google Maps)
        </label>
        <input
          id="geolocalizacion"
          name="geolocalizacion"
          className={input}
          defaultValue={inicial?.geolocalizacion ?? ''}
          placeholder="https://maps.app.goo.gl/..."
        />
      </div>

      <div>
        <label className={label} htmlFor="telefono_contacto">
          Teléfono de contacto
        </label>
        <input
          id="telefono_contacto"
          name="telefono_contacto"
          className={input}
          defaultValue={inicial?.telefono_contacto ?? ''}
          placeholder="999 999 999"
        />
      </div>

      <div>
        <label className={label} htmlFor="precio_por_hora">
          Precio por hora (S/)
        </label>
        <input
          id="precio_por_hora"
          name="precio_por_hora"
          type="number"
          min="0"
          step="0.01"
          className={input}
          defaultValue={inicial?.precio_por_hora ?? 0}
        />
        <p className="mt-1 text-xs text-tenue">
          Se usa para calcular el costo de sede al crear un evento.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="notas">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          className={input}
          rows={3}
          defaultValue={inicial?.notas ?? ''}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={inicial?.activo ?? true}
        />
        Sede activa (disponible para crear eventos)
      </label>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar'}
        </button>
        <Link
          href="/admin/sedes"
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
