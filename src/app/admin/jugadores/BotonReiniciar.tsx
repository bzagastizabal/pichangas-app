'use client';

import { reiniciarPassword } from './actions';

export function BotonReiniciar({ id, nombre }: { id: string; nombre: string }) {
  return (
    <form
      action={reiniciarPassword}
      onSubmit={(e) => {
        if (!confirm(`¿Reiniciar la clave de "${nombre}" a su DNI?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-tenue hover:underline">
        Reiniciar clave
      </button>
    </form>
  );
}
