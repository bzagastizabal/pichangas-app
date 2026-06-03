// Form compartido para crear y editar torneos.
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { EstadoForm, EstadoTorneo, Torneo } from '@/lib/types';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

const ESTADOS: { v: EstadoTorneo; l: string }[] = [
  { v: 'convocados', l: 'Convocados' },
  { v: 'inscritos', l: 'Inscritos' },
  { v: 'en_curso', l: 'En curso' },
  { v: 'finalizado', l: 'Finalizado' },
  { v: 'cancelado', l: 'Cancelado' },
];

export function TorneoForm({
  action,
  categorias,
  inicial,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  categorias: { id: string; nombre: string }[];
  inicial?: Torneo;
}) {
  const [estado, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="nombre">Nombre *</label>
          <input
            id="nombre"
            name="nombre"
            className={input}
            defaultValue={inicial?.nombre ?? ''}
            required
            placeholder="Copa de Verano 2026"
          />
        </div>

        <div>
          <label className={label} htmlFor="organizador">Organizador</label>
          <input
            id="organizador"
            name="organizador"
            className={input}
            defaultValue={inicial?.organizador ?? ''}
            placeholder="Liga Lima Sur"
          />
        </div>

        <div>
          <label className={label} htmlFor="categoria_id">Categoría</label>
          <select
            id="categoria_id"
            name="categoria_id"
            className={input}
            defaultValue={inicial?.categoria_id ?? ''}
          >
            <option value="">— Sin categoría —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="fecha_inicio">Fecha de inicio</label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            className={input}
            defaultValue={inicial?.fecha_inicio ?? ''}
          />
        </div>

        <div>
          <label className={label} htmlFor="fecha_fin">Fecha de fin</label>
          <input
            id="fecha_fin"
            name="fecha_fin"
            type="date"
            className={input}
            defaultValue={inicial?.fecha_fin ?? ''}
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
          <label className={label} htmlFor="estado">Estado</label>
          <select
            id="estado"
            name="estado"
            className={input}
            defaultValue={inicial?.estado ?? 'convocados'}
          >
            {ESTADOS.map((e) => (
              <option key={e.v} value={e.v}>{e.l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="posicion_final">Posición final</label>
          <input
            id="posicion_final"
            name="posicion_final"
            className={input}
            defaultValue={inicial?.posicion_final ?? ''}
            placeholder="Campeones, sub-campeones, etc."
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="notas">Notas</label>
          <textarea
            id="notas"
            name="notas"
            className={input}
            rows={3}
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
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <Link
          href="/admin/torneos"
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
