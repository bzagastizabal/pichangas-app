// src/app/admin/arbitros/nueva/page.tsx
// Pantalla para crear un árbitro.
import { ArbitroForm } from '../ArbitroForm';
import { crearArbitro } from '../actions';

export default function NuevoArbitroPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo árbitro</h1>
      <ArbitroForm action={crearArbitro} />
    </div>
  );
}
