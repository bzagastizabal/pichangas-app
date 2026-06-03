import { createClient } from '@/lib/supabase/server';
import { crearTorneo } from '../actions';
import { TorneoForm } from '../TorneoForm';

export default async function NuevoTorneoPage() {
  const supabase = await createClient();
  const { data: cats } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo torneo</h1>
      <TorneoForm action={crearTorneo} categorias={(cats as { id: string; nombre: string }[]) ?? []} />
    </div>
  );
}
