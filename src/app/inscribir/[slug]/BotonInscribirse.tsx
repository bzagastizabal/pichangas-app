// src/app/inscribir/[slug]/BotonInscribirse.tsx
// Botón cliente que invoca la Server Action de inscripción y muestra
// estado de envío y errores.
'use client';

import { useActionState } from 'react';
import { inscribirse } from './actions';

export function BotonInscribirse({ eventoId }: { eventoId: string }) {
  const [estado, formAction, pending] = useActionState(inscribirse, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="evento_id" value={eventoId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {pending ? 'Reservando…' : 'Inscribirme 🏀'}
      </button>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
    </form>
  );
}
