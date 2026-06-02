// Form de alta de marcador. Tras crear, te lleva al panel de control.
'use client';

import { useActionState } from 'react';
import { crearMarcador } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-xs text-tenue mb-1';

export function CrearMarcadorForm() {
  const [estado, formAction, pending] = useActionState(crearMarcador, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Nombre LOCAL</label>
        <input name="nombre_local" defaultValue="LOCAL" className={input} />
      </div>
      <div>
        <label className={label}>Nombre VISITANTE</label>
        <input name="nombre_visitante" defaultValue="VISITANTE" className={input} />
      </div>
      <div>
        <label className={label}>Duración del periodo (min)</label>
        <input name="duracion_min" type="number" min={1} defaultValue={10} className={input} />
      </div>
      <div>
        <label className={label}>Shot clock (seg)</label>
        <input name="shot_seg" type="number" min={1} defaultValue={24} className={input} />
      </div>
      <div>
        <label className={label}>Expira en (horas)</label>
        <input name="horas_expiracion" type="number" min={1} defaultValue={24} className={input} />
      </div>
      <div className="sm:col-span-2">
        {estado.error && <p className="text-sm text-red-400 mb-2">{estado.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear y abrir control'}
        </button>
      </div>
    </form>
  );
}
