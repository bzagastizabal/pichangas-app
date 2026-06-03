// Form de alta del marcador. Permite desactivar reloj de periodo y/o shot
// clock (modo "solo contar puntos").
'use client';

import { useActionState, useState } from 'react';
import { crearMarcador } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';
const label = 'block text-xs text-tenue mb-1';

export function CrearMarcadorForm() {
  const [estado, formAction, pending] = useActionState(crearMarcador, {});
  const [conReloj, setConReloj] = useState(true);
  const [conShot, setConShot] = useState(true);

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

      <div className="sm:col-span-2 rounded-lg bg-black/20 ring-1 ring-white/5 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="tiene_reloj_periodo"
            checked={conReloj}
            onChange={(e) => setConReloj(e.target.checked)}
          />
          <span className="font-medium">Con reloj de periodo</span>
          <span className="text-xs text-tenue">(MM:SS por cuarto)</span>
        </label>
        {conReloj && (
          <div className="pl-6">
            <label className={label}>Duración del periodo (min)</label>
            <input
              name="duracion_min"
              type="number"
              min={1}
              defaultValue={10}
              className={`${input} max-w-[10rem]`}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="tiene_shot_clock"
            checked={conShot}
            onChange={(e) => setConShot(e.target.checked)}
          />
          <span className="font-medium">Con shot clock</span>
          <span className="text-xs text-tenue">(24/14 segundos)</span>
        </label>
        {conShot && (
          <div className="pl-6">
            <label className={label}>Shot clock (seg)</label>
            <input
              name="shot_seg"
              type="number"
              min={1}
              defaultValue={24}
              className={`${input} max-w-[10rem]`}
            />
          </div>
        )}

        {!conReloj && !conShot && (
          <p className="text-xs text-amber-300 pl-6">
            Modo "solo contar puntos": el marcador mostrará nombres, periodo y puntaje.
          </p>
        )}
      </div>

      <div>
        <label className={label}>Expira en (horas)</label>
        <input
          name="horas_expiracion"
          type="number"
          min={1}
          defaultValue={24}
          className={input}
        />
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
