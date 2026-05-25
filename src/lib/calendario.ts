// Enlace "Agregar a Google Calendar" para un evento.
function fmtUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function linkGoogleCalendar(opts: {
  titulo: string;
  inicioISO: string;
  duracionHoras: number;
  ubicacion?: string;
  detalles?: string;
}): string {
  const inicio = new Date(opts.inicioISO);
  const fin = new Date(inicio.getTime() + opts.duracionHoras * 3600 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.titulo,
    dates: `${fmtUtc(opts.inicioISO)}/${fmtUtc(fin.toISOString())}`,
    details: opts.detalles ?? '',
    location: opts.ubicacion ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
