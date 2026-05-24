// src/app/admin/BotonEliminar.tsx
// Botón de borrado reutilizable. Recibe la Server Action como prop y pide
// confirmación antes de enviar. El id va en un campo oculto del form.
'use client';

export function BotonEliminar({
  action,
  id,
  nombre,
}: {
  action: (formData: FormData) => void;
  id: string;
  nombre: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Eliminar
      </button>
    </form>
  );
}
