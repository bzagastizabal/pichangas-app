// src/app/admin/arbitros/ArbitroForm.tsx
// Formulario compartido para crear y editar árbitros.
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { Arbitro, EstadoForm } from '@/lib/types';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

export function ArbitroForm({
  action,
  inicial,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial?: Arbitro;
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
          placeholder="Juan Pérez"
        />
      </div>

      <div>
        <label className={label} htmlFor="telefono">
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          className={input}
          defaultValue={inicial?.telefono ?? ''}
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
          Se usa para calcular el costo de arbitraje al crear un evento.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="tarifa_partido">
          Tarifa por partido (S/, opcional)
        </label>
        <input
          id="tarifa_partido"
          name="tarifa_partido"
          type="number"
          min="0"
          step="0.01"
          className={input}
          defaultValue={inicial?.tarifa_partido ?? 0}
        />
      </div>

      <div>
        <label className={label} htmlFor="calificacion">
          Calificación (1 a 5, opcional)
        </label>
        <input
          id="calificacion"
          name="calificacion"
          type="number"
          min="1"
          max="5"
          step="1"
          className={input}
          defaultValue={inicial?.calificacion ?? ''}
          placeholder="Sin calificar"
        />
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
        Árbitro activo (disponible para asignar a eventos)
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
          href="/admin/arbitros"
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
