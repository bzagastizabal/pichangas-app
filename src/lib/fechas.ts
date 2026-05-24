// src/lib/fechas.ts
// Utilidades de fecha/hora ancladas a la zona de Lima (Perú, UTC-5 fijo, sin DST).
// Los <input type="datetime-local"> entregan hora local sin zona; aquí la
// interpretamos siempre como hora de Lima para evitar desfases de 5 horas.

const ZONA = 'America/Lima';

// "2026-05-30T18:00" (hora de Lima) -> ISO con offset "2026-05-30T18:00:00-05:00".
export function datetimeLocalALimaISO(local: string): string {
  if (!local) return '';
  // datetime-local puede venir con o sin segundos.
  const conSegundos = local.length === 16 ? `${local}:00` : local;
  return `${conSegundos}-05:00`;
}

// timestamptz de la BD -> valor para <input type="datetime-local"> en hora de Lima.
export function isoADatetimeLocalLima(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ¿El evento ya terminó? (inicio + duración < ahora).
export function eventoYaTermino(fechaEvento: string, duracionHoras: number): boolean {
  const fin = new Date(fechaEvento).getTime() + duracionHoras * 3600 * 1000;
  return Date.now() > fin;
}

// timestamptz -> texto legible en español/Lima, p. ej. "30 may 2026, 18:00".
export function formatearFechaLima(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
