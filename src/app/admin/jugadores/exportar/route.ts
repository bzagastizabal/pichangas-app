// Exporta el padrón de jugadores a CSV (Excel lo abre nativamente).
// Pensado para entregar fichas en torneos.
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  calcularEdad,
  categoriaSugeridaPorEdad,
  type Categoria,
} from '@/lib/types';

type Perfil = {
  nombre_completo: string | null;
  dni: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  rol: string;
  activo: boolean;
};

// Escapa un campo para CSV: dobles comillas y wraps si contiene , " o salto.
function csv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: perfData }, { data: catsData }] = await Promise.all([
    supabase
      .from('perfiles')
      .select('nombre_completo, dni, telefono, fecha_nacimiento, nacionalidad, rol, activo')
      .order('nombre_completo'),
    supabase.from('categorias').select('id, nombre, edad_min, edad_max').eq('activo', true),
  ]);
  const perfiles = (perfData as Perfil[]) ?? [];
  const cats = (catsData as Pick<Categoria, 'id' | 'nombre' | 'edad_min' | 'edad_max'>[]) ?? [];

  const headers = [
    'Nombre completo',
    'DNI',
    'Fecha de nacimiento',
    'Edad',
    'Nacionalidad',
    'Teléfono',
    'Categoría sugerida',
    'Rol',
    'Estado',
  ];
  const lineas = [headers.join(',')];
  for (const p of perfiles) {
    const edad = calcularEdad(p.fecha_nacimiento);
    const cat = categoriaSugeridaPorEdad(edad, cats);
    lineas.push(
      [
        csv(p.nombre_completo),
        csv(p.dni),
        csv(p.fecha_nacimiento),
        csv(edad),
        csv(p.nacionalidad),
        csv(p.telefono),
        csv(cat?.nombre),
        csv(p.rol),
        csv(p.activo ? 'activo' : 'de baja'),
      ].join(','),
    );
  }
  // BOM al inicio para que Excel detecte UTF-8 con acentos.
  const cuerpo = '﻿' + lineas.join('\r\n');
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="jugadores-cmt-${fecha}.csv"`,
    },
  });
}
