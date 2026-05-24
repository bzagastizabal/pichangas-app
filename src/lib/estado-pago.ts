import { eventoYaTermino } from './fechas';

export type EstadoPagoJugador = 'pagado' | 'en_revision' | 'pendiente' | 'moroso';

// Estado de pago de un participante:
// - pagado: tiene pago aprobado.
// - en_revision: subió comprobante, falta validar.
// - pendiente: aún no paga y el evento NO ha terminado.
// - moroso: aún no paga y el evento ya terminó (fecha + duración).
export function estadoPagoJugador(
  inscEstado: string,
  pagos: { estado: string }[],
  fechaEvento: string,
  duracionHoras: number,
): EstadoPagoJugador {
  if (pagos.some((p) => p.estado === 'aprobado')) return 'pagado';
  if (pagos.some((p) => p.estado === 'en_revision')) return 'en_revision';
  if (inscEstado === 'pendiente' || inscEstado === 'confirmado') {
    return eventoYaTermino(fechaEvento, duracionHoras) ? 'moroso' : 'pendiente';
  }
  return 'pendiente';
}
