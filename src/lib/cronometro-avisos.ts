// src/lib/cronometro-avisos.ts
// Config de los avisos del modo cronometro (SQL 36) + textos en español.
// Vive aparte de audio-marcador.ts porque lo consumen tambien componentes de
// servidor/formularios (catalogo y etiquetas) que no deben tocar Web Audio.

export type ConfigAvisos = {
  // Segundos restantes en los que se anuncia por voz ("faltan 3 minutos").
  avisos: number[];
  // Veces que se repite cada aviso (el club pidio 2 para que se entienda).
  repetir: number;
  // Beep por segundo desde N segundos hasta 1 (0 = sin beeps).
  beepDesde: number;
  // Cuenta regresiva HABLADA de los ultimos N segundos (0 = desactivada).
  cuentaVozDesde: number;
};

export const AVISOS_DEFAULT = [180, 120, 60, 30, 10];
export const REPETIR_DEFAULT = 2;
export const BEEP_DESDE_DEFAULT = 15;
export const CUENTA_VOZ_DEFAULT = 0;

// Opciones que ofrece el UI (checkboxes). Orden de mayor a menor.
export const AVISOS_CATALOGO = [600, 300, 180, 120, 60, 45, 30, 15, 10, 5];

// Opciones del selector "empieza a sonar desde".
export const BEEP_OPCIONES = [0, 5, 10, 15, 20, 30, 60];

// Etiqueta corta para chips/checkboxes: 10 min, 3 min, 45 s...
export function etiquetaSeg(seg: number): string {
  if (seg <= 0) return 'off';
  if (seg % 60 === 0) return `${seg / 60} min`;
  if (seg < 60) return `${seg} s`;
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
  'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
];

// Numero hablado (1..20). Fuera de rango cae al digito para que la voz no
// deletree raro.
export function numeroEnPalabras(n: number): string {
  return UNIDADES[n] ?? String(n);
}

const DECENAS: Record<number, string> = {
  30: 'treinta', 40: 'cuarenta', 45: 'cuarenta y cinco', 50: 'cincuenta',
};

// Texto que dice la voz al cruzar el hito. Se compone para cualquier valor
// del catalogo (y para valores custom que llegaran de la DB).
export function textoAviso(seg: number): string {
  if (seg >= 60 && seg % 60 === 0) {
    const min = seg / 60;
    return min === 1 ? 'Falta un minuto' : `Faltan ${numeroEnPalabras(min)} minutos`;
  }
  if (seg < 60) {
    const palabra = seg <= 20 ? numeroEnPalabras(seg) : (DECENAS[seg] ?? String(seg));
    return seg === 1 ? 'Falta un segundo' : `Faltan ${palabra} segundos`;
  }
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  return `Faltan ${numeroEnPalabras(min)} minutos ${numeroEnPalabras(s)} segundos`;
}

// Normaliza la config leida de la fila. Todos los campos son opcionales
// porque SQL 36 puede no haber corrido todavia en la instancia.
export function configAvisos(m: {
  avisos_seg?: number[] | null;
  avisos_repetir?: number | null;
  beep_desde_seg?: number | null;
  voz_cuenta_desde?: number | null;
}): ConfigAvisos {
  const avisos = Array.isArray(m.avisos_seg) && m.avisos_seg.length
    ? [...m.avisos_seg].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a)
    : AVISOS_DEFAULT;
  return {
    avisos,
    repetir: clampInt(m.avisos_repetir, 1, 3, REPETIR_DEFAULT),
    beepDesde: clampInt(m.beep_desde_seg, 0, 60, BEEP_DESDE_DEFAULT),
    cuentaVozDesde: clampInt(m.voz_cuenta_desde, 0, 20, CUENTA_VOZ_DEFAULT),
  };
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Resumen legible de la config (para hints del UI).
export function resumenAvisos(c: ConfigAvisos): string {
  const hitos = c.avisos.length
    ? c.avisos.map(etiquetaSeg).join(' · ')
    : 'sin avisos de voz';
  const beep = c.beepDesde > 0 ? `beep desde ${c.beepDesde} s` : 'sin beep';
  const rep = c.repetir > 1 ? `×${c.repetir}` : '';
  const cuenta = c.cuentaVozDesde > 0 ? ` · cuenta hablada ${c.cuentaVozDesde}→1` : '';
  return `${hitos} ${rep} · ${beep}${cuenta}`.replace(/\s+/g, ' ').trim();
}
