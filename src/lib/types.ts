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
  tarifa_1h: number;
  tarifa_2h: number;
  tarifa_3h: number;
  tarifa_mas: number;
  calificacion: number | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
};

// Tarifas del árbitro (subset usado para calcular costos).
export type TarifasArbitro = {
  tarifa_1h: number; // tarifa FIJA para 1 h
  tarifa_2h: number; // tarifa FIJA para 2 h
  precio_por_hora: number; // tarifa POR HORA para 3 h o más
};

// Costo del árbitro según la duración del evento:
//  - 1 h y 2 h: tarifa FIJA (tarifa_1h / tarifa_2h).
//  - 3 h o más (y tramos intermedios > 2 h): por hora = precio_por_hora × duración
//    (p. ej. precio 40 → 3 h = 120, 4 h = 160).
// Si la tarifa fija de 1 h/2 h está en 0, cae a precio_por_hora × duración.
export function costoArbitroTramo(a: TarifasArbitro, duracion: number): number {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (duracion <= 1) return a.tarifa_1h || r2(a.precio_por_hora * duracion);
  if (duracion <= 2) return a.tarifa_2h || r2(a.precio_por_hora * duracion);
  return r2(a.precio_por_hora * duracion);
}

export type EstadoEvento = 'abierta' | 'cerrada' | 'cancelada' | 'finalizada';
export type TipoEvento = 'pichanga' | 'amistoso' | 'torneo';

export type Categoria = {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
};

export type Evento = {
  id: string;
  tipo_deporte: string;
  tipo: TipoEvento;
  categoria_id: string | null;
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

export type Publicacion = {
  id: string;
  titulo: string;
  descripcion: string | null;
  evento_id: string | null;
  imagenes: string[];
  autor_id: string | null;
  publicado: boolean;
  created_at: string;
};

export type Staff = {
  id: string;
  nombre: string;
  cargo: string | null;
  whatsapp: string | null;
  es_default: boolean;
  orden: number;
  activo: boolean;
  created_at: string;
};

export type MetodoEgreso = 'yape' | 'plin' | 'banco' | 'efectivo';

export type Egreso = {
  id: string;
  evento_id: string | null;
  tipo: 'sede' | 'arbitro' | 'otro';
  sede_id: string | null;
  arbitro_id: string | null;
  monto: number;
  metodo: MetodoEgreso | null;
  fecha_pago: string;
  nota: string | null;
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

export type Notificacion = {
  id: string;
  usuario_id: string;
  evento_id: string | null;
  tipo: 'promovido' | 'liberado' | 'expirado' | 'confirmado';
  mensaje: string;
  leida: boolean;
  created_at: string;
};

// Estado que devuelven las Server Actions de formularios (para useActionState).
export type EstadoForm = { error?: string };

// Cálculo de costo por participante (misma fórmula que documenta CLAUDE.md).
// costo = (costo_sede + costo_arbitraje) * (1 + %ganancia/100) / cupos_totales
// Se redondea HACIA ARRIBA a soles enteros: el redondeo extra se suma a la
// ganancia (cobrar montos cerrados facilita el pago por Yape/Plin).
export function calcularCostoPorParticipante(
  costoSede: number,
  costoArbitraje: number,
  porcentajeGanancia: number,
  cuposTotales: number,
): number {
  if (!cuposTotales || cuposTotales <= 0) return 0;
  const base = costoSede + costoArbitraje;
  const conGanancia = base * (1 + porcentajeGanancia / 100);
  return Math.ceil(conGanancia / cuposTotales);
}
