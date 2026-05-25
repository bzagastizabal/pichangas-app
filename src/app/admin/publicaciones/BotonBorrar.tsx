'use client';

import { eliminarPublicacion } from './actions';

export function BotonBorrar({ id, imagenes, titulo }: { id: string; imagenes: string[]; titulo: string }) {
  return (
    <form
      action={eliminarPublicacion}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar la publicación "${titulo}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="imagenes" value={JSON.stringify(imagenes)} />
      <button type="submit" className="text-sm text-red-400 hover:underline">
        Eliminar
      </button>
    </form>
  );
}
