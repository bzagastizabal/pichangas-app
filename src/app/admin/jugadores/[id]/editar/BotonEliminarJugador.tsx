// Botón rojo con doble confirm para evitar borrados accidentales. El segundo
// confirm pide tipear "ELIMINAR" para autorizar.
'use client';

export function BotonEliminarJugador({
  accion,
  id,
  nombre,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  id: string;
  nombre: string;
}) {
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar DEFINITIVAMENTE a "${nombre}"?\n\nBorra cuenta + inscripciones + pagos. No se puede deshacer.`)) {
          e.preventDefault();
          return;
        }
        const tipeo = prompt('Para confirmar, escribe ELIMINAR en mayúsculas:');
        if (tipeo !== 'ELIMINAR') {
          e.preventDefault();
          alert('Cancelado.');
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-500"
      >
        Eliminar definitivamente
      </button>
    </form>
  );
}
