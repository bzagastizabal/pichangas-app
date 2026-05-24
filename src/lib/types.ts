// src/lib/types.ts
// Tipos compartidos del dominio. Reflejan el esquema ya creado en Supabase.

export type Sede = {
  id: string;
  nombre: string;
  direccion: string | null;
  geolocalizacion: string | null;
  telefono_contacto: string | null;
  precio_por_hora: number;
  notas: string | null;
  activo: boolean;
  created_at: string;
};

export type Arbitro = {
  id: string;
  nombre: string;
  telefono: string | null;
  tarifa_partido: number;
  precio_por_hora: number;
  calificacion: number | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
};

export type EstadoEvento = 'abierta' | 'cerrada' | 'cancelada' | 'finalizada';

export type Evento = {
  id: string;
  tipo_deporte: string;
  sede_id: string;
  arbitro_id: string | null;
  admin_id: string;
  fecha_hora_evento: string;
  fecha_hora_limite_pago: string;
  duracion_horas: number;
  cupos_totales: number;
  minimo_requerido: number;
  costo_sede: number;
  costo_arbitraje: number;
  porcentaje_ganancia: number;
  costo_por_participante: number;
  estado: EstadoEvento;
  slug_inscripcion: string;
  created_at: string;
};

// Evento con la sede embebida (para listados con join de PostgREST).
export type EventoConSede = Evento & {
  sedes: { nombre: string } | null;
  arbitros: { nombre: string } | null;
};

export type EstadoInscripcion =
  | 'pendiente'
  | 'confirmado'
  | 'lista_espera'
  | 'expirado'
  | 'liberado';

export type Inscripcion = {
  id: string;
  evento_id: string;
  usuario_id: string;
  estado: EstadoInscripcion;
  posicion_lista: number | null;
  fecha_reserva: string;
  fecha_expiracion: string | null;
  created_at: string;
};

export type MetodoPago = 'yape' | 'plin' | 'banco';
export type EstadoPago = 'en_revision' | 'aprobado' | 'rechazado';

export type Pago = {
  id: string;
  inscripcion_id: string;
  url_comprobante: string | null;
  metodo: MetodoPago;
  monto_declarado: number;
  estado: EstadoPago;
  fecha_subida: string;
  fecha_validacion: string | null;
  validado_por: string | null;
  motivo_rechazo: string | null;
  comprobante_eliminado: boolean;
};

// Estado que devuelven las Server Actions de formularios (para useActionState).
export type EstadoForm = { error?: string };

// Cálculo de costo por participante (misma fórmula que documenta CLAUDE.md).
// costo = (costo_sede + costo_arbitraje) * (1 + %ganancia/100) / cupos_totales
export function calcularCostoPorParticipante(
  costoSede: number,
  costoArbitraje: number,
  porcentajeGanancia: number,
  cuposTotales: number,
): number {
  if (!cuposTotales || cuposTotales <= 0) return 0;
  const base = costoSede + costoArbitraje;
  const conGanancia = base * (1 + porcentajeGanancia / 100);
  return Math.round((conGanancia / cuposTotales) * 100) / 100;
}
