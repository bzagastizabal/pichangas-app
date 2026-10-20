// src/lib/sonidos.ts
// Efectos de sonido del cronómetro (SQL 40). Los sube el admin y se disparan
// desde el propio cronómetro — también desde el link público de operador.

export const BUCKET_EFECTOS = 'efectos';

export type EfectoSonido = {
  id: string;
  nombre: string;
  emoji: string | null;
  path: string;
  orden: number;
  activo: boolean;
  created_at: string;
};

// Lo que necesita el visor para pintar y reproducir (sin datos de gestión).
export type EfectoVisor = {
  id: string;
  nombre: string;
  emoji: string | null;
  url: string;
};

// Nombre legible a partir del archivo: "risa_publico.mp3" → "Risa publico".
export function nombreDesdeArchivo(archivo: string): string {
  const base = archivo.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  if (!base) return 'Efecto';
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 60);
}
