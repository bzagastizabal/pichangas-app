// src/lib/voces.ts
// Catálogo de clips de un pack de voz (SQL 37). Define QUÉ audios puede subir
// el admin, con qué nombre de archivo y qué debería decir cada uno — el mismo
// catálogo alimenta la grilla de subida y la reproducción en el visor.

import { AVISOS_CATALOGO, textoAviso, numeroEnPalabras } from './cronometro-avisos';

export const BUCKET_VOCES = 'voces';

// Cuenta regresiva hablada: 10 → 1 (los valores 11..20 caen a voz sintetizada).
export const CUENTA_CATALOGO = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export type Ranura = {
  clave: string;      // identificador guardado en voces_clips.clave
  grupo: 'hito' | 'cuenta' | 'especial';
  titulo: string;     // cómo se muestra en la grilla
  guion: string;      // texto sugerido para grabar/generar
  archivo: string;    // nombre de archivo sugerido (para la subida masiva)
};

export function claveHito(seg: number): string {
  return `h${seg}`;
}
export function claveCuenta(n: number): string {
  return `c${n}`;
}

export const RANURAS: Ranura[] = [
  ...AVISOS_CATALOGO.map((seg): Ranura => ({
    clave: claveHito(seg),
    grupo: 'hito',
    titulo: seg >= 60 ? `Faltan ${seg / 60} min` : `Faltan ${seg} s`,
    guion: textoAviso(seg),
    archivo: `${claveHito(seg)}.mp3`,
  })),
  ...CUENTA_CATALOGO.map((n): Ranura => ({
    clave: claveCuenta(n),
    grupo: 'cuenta',
    titulo: `Cuenta: ${n}`,
    guion: numeroEnPalabras(n),
    archivo: `${claveCuenta(n)}.mp3`,
  })),
  {
    clave: 'inicio',
    grupo: 'especial',
    titulo: 'Al arrancar',
    guion: 'Ej. "¡Empezamos!" — suena cuando el operador da play.',
    archivo: 'inicio.mp3',
  },
  {
    clave: 'fin',
    grupo: 'especial',
    titulo: 'Al llegar a cero',
    guion: 'Ej. "¡Se acabó el tiempo!" — reemplaza la bocina si lo subes.',
    archivo: 'fin.mp3',
  },
];

export const GRUPOS: Array<{ grupo: Ranura['grupo']; titulo: string; ayuda: string }> = [
  {
    grupo: 'hito',
    titulo: 'Avisos de tiempo',
    ayuda: 'Suenan al cruzar cada hito que tengas activado en el marcador.',
  },
  {
    grupo: 'cuenta',
    titulo: 'Cuenta regresiva 10 → 1',
    ayuda: 'Solo suenan si el marcador tiene activada la cuenta hablada.',
  },
  {
    grupo: 'especial',
    titulo: 'Extras',
    ayuda: 'Opcionales.',
  },
];

// Deduce la clave a partir del nombre de archivo, para la subida masiva.
// Acepta "h180.mp3", "180.mp3", "3min.mp3", "c10.mp3", "inicio.wav"...
// Un número pelado se interpreta como HITO ("10.mp3" = "faltan diez segundos");
// para la cuenta regresiva hay que usar el prefijo c ("c10.mp3").
export function claveDesdeNombre(nombre: string): string | null {
  const base = nombre
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  const directa = RANURAS.find((r) => r.clave === base);
  if (directa) return directa.clave;
  if (base === 'inicio' || base === 'start') return 'inicio';
  if (base === 'fin' || base === 'final' || base === 'end') return 'fin';
  const min = base.match(/^(\d+)(?:min|m)$/);
  if (min) {
    const seg = parseInt(min[1], 10) * 60;
    return RANURAS.some((r) => r.clave === claveHito(seg)) ? claveHito(seg) : null;
  }
  const seg = base.match(/^(\d+)(?:s|seg|segundos)?$/);
  if (seg) {
    const n = parseInt(seg[1], 10);
    return RANURAS.some((r) => r.clave === claveHito(n)) ? claveHito(n) : null;
  }
  return null;
}

export type VozPaquete = {
  id: string;
  nombre: string;
  descripcion: string | null;
  creado_por: string | null;
  created_at: string;
};

export type VozClip = {
  id: string;
  paquete_id: string;
  clave: string;
  path: string;
};
