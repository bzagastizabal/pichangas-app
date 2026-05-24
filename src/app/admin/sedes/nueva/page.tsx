// src/app/admin/sedes/nueva/page.tsx
// Pantalla para crear una sede.
import { SedeForm } from '../SedeForm';
import { crearSede } from '../actions';

export default function NuevaSedePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva sede</h1>
      <SedeForm action={crearSede} />
    </div>
  );
}
