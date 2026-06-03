// Plantilla CSV con las columnas esperadas y dos filas de ejemplo. BOM al
// inicio para que Excel detecte UTF-8 (no se rompen los acentos).
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const filas = [
    'Nombre completo,DNI,Fecha de nacimiento,Nacionalidad,Telefono,Email,Estado',
    'Juan Perez,12345678,1990-05-15,Peruana,51999888777,,activo',
    'Maria Lopez,87654321,1995-08-22,Peruana,51988777666,maria@correo.com,activo',
  ];
  const cuerpo = '﻿' + filas.join('\r\n');
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-jugadores-cmt.csv"',
    },
  });
}
