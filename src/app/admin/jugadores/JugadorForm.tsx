'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { crearJugador } from './actions';
import { TelefonoInput } from '@/components/TelefonoInput';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export function JugadorForm() {
  const [estado, formAction, pending] = useActionState(crearJugador, {});
  const ref = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!pending && !estado.error) {
      ref.current?.reset();
      setResetKey((k) => k + 1);
    }
  }, [pending, estado]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-tenue mb-1">Nombre *</label>
          <input name="nombre_completo" className={input} required />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">DNI *</label>
          <input name="dni" className={input} required />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Teléfono</label>
          <TelefonoInput key={resetKey} name="telefono" />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Correo (opcional)</label>
          <input name="email" type="email" className={input} />
        </div>
        <div>
          <label className="block text-xs text-tenue mb-1">Clave (opcional)</label>
          <input name="password" className={input} placeholder="por defecto: el DNI" />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full"
          >
            {pending ? 'Creando…' : 'Crear jugador'}
          </button>
        </div>
      </div>
      {estado.error && <p className="text-sm text-red-500">{estado.error}</p>}
    </form>
  );
}
