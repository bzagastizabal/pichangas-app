// Parser CSV mínimo pero robusto: BOM, comillas con escape doble (""), salto
// dentro de comillas, y autodetección de separador ( , o ; — común en Excel ES).
export function parsearCSV(texto: string): string[][] {
  let t = texto.replace(/^﻿/, '');
  // Auto-detección por primera línea: el carácter más frecuente entre , y ;
  const primera = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) >
              (primera.match(/,/g)?.length ?? 0)
    ? ';'
    : ',';

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let dentro = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const sig = t[i + 1];
    if (dentro) {
      if (c === '"' && sig === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        dentro = false;
      } else {
        campo += c;
      }
    } else {
      if (c === '"') {
        dentro = true;
      } else if (c === sep) {
        fila.push(campo);
        campo = '';
      } else if (c === '\r') {
        // ignora
      } else if (c === '\n') {
        fila.push(campo);
        filas.push(fila);
        fila = [];
        campo = '';
      } else {
        campo += c;
      }
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  // Filtra filas completamente vacías (espacios en blanco solo).
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
}

// Normaliza el header (minúsculas, sin acentos, snake_case) para mapear flexible.
export function normalizarHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Convierte fechas comunes (ISO, DD/MM/YYYY, DD-MM-YYYY) a YYYY-MM-DD.
export function parsearFecha(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) {
    const [, d, mm, y] = m;
    return `${y}-${mm.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
