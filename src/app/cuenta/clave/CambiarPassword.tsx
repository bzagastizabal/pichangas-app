'use client';

import { useActionState } from 'react';
import { cambiarMiPassword } from './actions';

const input = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export function CambiarPassword() {
  const [estado, action, pending] = useActionState(cambiarMiPassword, {});

  return (
    <form action={action} className="space-y-3">
      <input name="password" type="password" placeholder="Nueva contraseña" className={input} required />
      <input name="confirmar" type="password" placeholder="Repite la contraseña" className={input} required />
      <button
        type="submit"
        disabled={pending}
        className="bg-orange-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
      {estado.error && <p className="text-sm text-red-500">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-400">Contraseña actualizada.</p>}
    </form>
  );
}
