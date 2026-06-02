// Lista de cumpleañeros del mes en curso. Server component: lee perfiles con
// RLS (todos los logueados ven la lista; los anónimos no llegan al dashboard).
import { createClient } from '@/lib/supabase/server';

const meses = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

type Cumple = { nombre_completo: string | null; fecha_nacimiento: string };

export async function CumpleanosDelMes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('perfiles')
    .select('nombre_completo, fecha_nacimiento')
    .eq('activo', true)
    .not('fecha_nacimiento', 'is', null);

  const hoy = new Date();
  const mes = hoy.getMonth(); // 0-11
  const filas = ((data as Cumple[]) ?? [])
    .map((p) => ({ ...p, dia: new Date(p.fecha_nacimiento).getDate(), mesNac: new Date(p.fecha_nacimiento).getMonth() }))
    .filter((p) => p.mesNac === mes)
    .sort((a, b) => a.dia - b.dia);

  if (filas.length === 0) return null;

  return (
    <section className="rounded-lg border border-borde p-4 space-y-2">
      <h2 className="font-semibold">🎂 Cumpleaños de {meses[mes]}</h2>
      <ul className="text-sm text-tenue space-y-1">
        {filas.map((p, i) => {
          const esHoy = p.dia === hoy.getDate();
          return (
            <li key={i} className={esHoy ? 'text-orange-400' : ''}>
              <span className="font-medium text-texto">{p.dia}</span>
              {' · '}
              {p.nombre_completo ?? '—'}
              {esHoy && ' 🎉 hoy'}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
