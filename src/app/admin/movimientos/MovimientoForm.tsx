// src/app/admin/movimientos/MovimientoForm.tsx
// Formulario para registrar un movimiento (ingreso o egreso). Permite adjuntar
// el sustento como imagen o PDF. Las categorías cambian según el tipo elegido.
'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  ETIQUETA_CATEGORIA,
  type EstadoForm,
  type TipoMovimiento,
} from '@/lib/types';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-sm font-medium text-texto mb-1';

export function MovimientoForm({
  action,
  eventos,
  eventoInicial = '',
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  eventos: { id: string; nombre: string }[];
  eventoInicial?: string;
}) {
  const [estado, formAction, pending] = useActionState(action, {});
  const [tipo, setTipo] = useState<TipoMovimiento>('ingreso');
  const categorias =
    tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <form action={formAction} className="space-y-4 max-w-xl" encType="multipart/form-data">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            name="tipo"
            className={input}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="categoria">Categoría</label>
          <select id="categoria" name="categoria" className={input} required>
            {categorias.map((c) => (
              <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="monto">Monto (S/) *</label>
          <input
            id="monto"
            name="monto"
            type="number"
            min="0.01"
            step="0.01"
            className={input}
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="fecha">Fecha *</label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            className={input}
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="descripcion">Descripción *</label>
          <input
            id="descripcion"
            name="descripcion"
            className={input}
            placeholder="Donación de Juan Pérez para uniformes"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="evento_id">
            Evento relacionado (opcional)
          </label>
          <select id="evento_id" name="evento_id" className={input} defaultValue={eventoInicial}>
            <option value="">— Sin evento —</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="sustento">
            Sustento (imagen o PDF, máx. 5 MB) *
          </label>
          <input
            id="sustento"
            name="sustento"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm"
            required
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
          {pending ? 'Guardando…' : 'Registrar movimiento'}
        </button>
        <Link
          href="/admin/movimientos"
          className="px-4 py-2 rounded border border-borde text-texto"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
