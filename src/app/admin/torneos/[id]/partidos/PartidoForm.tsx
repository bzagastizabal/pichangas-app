// Form compartido para crear/editar partido del torneo.
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { EstadoForm, EstadoPartido, Partido } from '@/lib/types';
import { isoADatetimeLocalLima } from '@/lib/fechas';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

const ESTADOS: { v: EstadoPartido; l: string }[] = [
  { v: 'programado', l: 'Programado' },
  { v: 'jugado', l: 'Jugado' },
  { v: 'wo', l: 'W.O.' },
  { v: 'aplazado', l: 'Aplazado' },
  { v: 'cancelado', l: 'Cancelado' },
];

export function PartidoForm({
  action,
  torneoId,
  inicial,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  torneoId: string;
  inicial?: Partido;
}) {
  const [estado, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      <input type="hidden" name="torneo_id" value={torneoId} />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="rival">Rival *</label>
          <input
            id="rival"
            name="rival"
            className={input}
            defaultValue={inicial?.rival ?? ''}
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="fecha">Fecha y hora *</label>
          <input
            id="fecha"
            name="fecha"
            type="datetime-local"
            className={input}
            defaultValue={inicial ? isoADatetimeLocalLima(inicial.fecha) : ''}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="ubicacion">Ubicación / sede</label>
          <input
            id="ubicacion"
            name="ubicacion"
            className={input}
            defaultValue={inicial?.ubicacion ?? ''}
          />
        </div>

        <div>
          <label className={label} htmlFor="puntos_propio">Puntos CMT</label>
          <input
            id="puntos_propio"
            name="puntos_propio"
            type="number"
            min="0"
            className={input}
            defaultValue={inicial?.puntos_propio ?? ''}
          />
        </div>

        <div>
          <label className={label} htmlFor="puntos_rival">Puntos rival</label>
          <input
            id="puntos_rival"
            name="puntos_rival"
            type="number"
            min="0"
            className={input}
            defaultValue={inicial?.puntos_rival ?? ''}
          />
        </div>

        <div>
          <label className={label} htmlFor="estado">Estado</label>
          <select
            id="estado"
            name="estado"
            className={input}
            defaultValue={inicial?.estado ?? 'programado'}
          >
            {ESTADOS.map((e) => (
              <option key={e.v} value={e.v}>{e.l}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="notas">Notas</label>
          <textarea
            id="notas"
            name="notas"
            className={input}
            rows={2}
            defaultValue={inicial?.notas ?? ''}
          />
        </div>
      </div>

      {estado.error && <p className="text-sm text-red-400">{estado.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar partido'}
        </button>
        <Link
          href={`/admin/torneos/${torneoId}`}
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
