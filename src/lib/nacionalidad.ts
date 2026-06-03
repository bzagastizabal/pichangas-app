// Normaliza nacionalidad a una de las 4 opciones canónicas. "Peru", "perú",
// "PERUANO", "peruana" → "Peruana". Otras se devuelven tal cual para que
// puedan entrar como "Otro" en el select.

export const NACIONALIDADES = [
  { valor: 'Peruana', etiqueta: '🇵🇪 Perú' },
  { valor: 'Venezolana', etiqueta: '🇻🇪 Venezuela' },
  { valor: 'Colombiana', etiqueta: '🇨🇴 Colombia' },
] as const;

export type NacionalidadCanonica = (typeof NACIONALIDADES)[number]['valor'];

export const VALORES_CANONICOS: ReadonlySet<string> = new Set(
  NACIONALIDADES.map((n) => n.valor),
);

export function normalizarNacionalidad(s: string | null | undefined): string {
  const t = (s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!t) return '';
  if (/^per(u|uan)/.test(t)) return 'Peruana';
  if (/^vene/.test(t)) return 'Venezolana';
  if (/^col/.test(t)) return 'Colombiana';
  return (s ?? '').trim();
}
