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
// Cómo reasigna cupos cuando un en_espera paga.
//  · inmediato   = clásico: "el que paga primero gana" en cualquier momento.
//  · tras_limite = respeta fecha límite: solo desplaza morosos tras el límite.
export type ModoCupos = 'inmediato' | 'tras_limite';

export type Categoria = {
  id: string;
  nombre: string;
  // Rango de edad opcional: si se define, podemos sugerir la categoría a partir
  // de fecha_nacimiento del jugador.
  edad_min: number | null;
  edad_max: number | null;
  activo: boolean;
  created_at: string;
};

// Edad en años cumplidos a partir de la fecha de nacimiento (YYYY-MM-DD).
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const n = new Date(fechaNacimiento);
  if (Number.isNaN(n.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
  return edad;
}

// Categoría a la que PERTENECE el jugador por su edad. Si calzan varias,
// gana la de RANGO MÁS CHICO (la más específica). Ej: edad 41, categorías
// {17-55} (rango 38) y {38-55} (rango 17) → gana 38-55.
// Sin edad o sin categoría que calce → null.
export function categoriaDelJugador(
  edad: number | null,
  categorias: Pick<Categoria, 'id' | 'nombre' | 'edad_min' | 'edad_max'>[],
): { id: string; nombre: string } | null {
  if (edad == null) return null;
  const calzan = categorias.filter((c) => {
    const min = c.edad_min ?? -Infinity;
    const max = c.edad_max ?? Infinity;
    return edad >= min && edad <= max;
  });
  if (calzan.length === 0) return null;
  // Categorías sin uno de los límites tienen rango infinito (menos específicas).
  const rango = (c: (typeof calzan)[number]) =>
    c.edad_min == null || c.edad_max == null
      ? Number.POSITIVE_INFINITY
      : c.edad_max - c.edad_min;
  calzan.sort((a, b) => rango(a) - rango(b));
  return { id: calzan[0].id, nombre: calzan[0].nombre };
}

// Alias retro-compatible (algunos archivos todavía lo importan).
export const categoriaSugeridaPorEdad = categoriaDelJugador;

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
  // Destino del pago (Yape/Plin). Snapshot al momento del alta del evento.
  pago_telefono: string | null;
  pago_titular: string | null;
  modo_cupos: ModoCupos;
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
  foto_url: string | null;
  es_default: boolean;
  orden: number;
  activo: boolean;
  created_at: string;
};

// Tipo público de perfil (se usa en listados / dashboard).
export type PerfilExtendido = {
  id: string;
  nombre_completo: string | null;
  dni: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  rol: 'participante' | 'administrador';
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

export type MetodoPago = 'yape' | 'plin' | 'banco' | 'efectivo';
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

// Movimientos financieros independientes (donaciones, premios, gastos varios,
// etc.). NO incluye los costos/ingresos automáticos de los eventos.
export type TipoMovimiento = 'ingreso' | 'egreso';
export type CategoriaMovimiento =
  | 'donacion'
  | 'premio'
  | 'aporte'
  | 'saldo_pichanga'
  | 'compra'
  | 'gasto'
  | 'pago'
  | 'reembolso'
  | 'otro';
export type EstadoMovimiento = 'pendiente' | 'aprobado' | 'rechazado';

// Categorías por tipo: el form solo deja elegir las que correspondan.
export const CATEGORIAS_INGRESO: CategoriaMovimiento[] = [
  'donacion',
  'premio',
  'aporte',
  'saldo_pichanga',
  'otro',
];
export const CATEGORIAS_EGRESO: CategoriaMovimiento[] = [
  'compra',
  'gasto',
  'pago',
  'reembolso',
  'otro',
];

export const ETIQUETA_CATEGORIA: Record<CategoriaMovimiento, string> = {
  donacion: 'Donación',
  premio: 'Premio',
  aporte: 'Aporte',
  saldo_pichanga: 'Saldo a favor (pichanga)',
  compra: 'Compra',
  gasto: 'Gasto',
  pago: 'Pago',
  reembolso: 'Reembolso',
  otro: 'Otro',
};

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  categoria: CategoriaMovimiento;
  monto: number;
  descripcion: string;
  fecha: string;
  evento_id: string | null;
  url_sustento: string;
  estado: EstadoMovimiento;
  creado_por: string;
  aprobado_por: string | null;
  fecha_aprobado: string | null;
  motivo_rechazo: string | null;
  created_at: string;
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

// Marcador de baloncesto (utilitario independiente).
export type Marcador = {
  id: string;
  slug: string;
  nombre_local: string;
  nombre_visitante: string;
  puntos_local: number;
  puntos_visitante: number;
  faltas_local: number;
  faltas_visitante: number;
  timeouts_local: number;
  timeouts_visitante: number;
  periodo: number;
  duracion_periodo_seg: number;
  reloj_restante_ms: number;
  reloj_corriendo: boolean;
  reloj_inicio: string | null;
  shot_duracion_ms: number;
  shot_restante_ms: number;
  shot_corriendo: boolean;
  shot_inicio: string | null;
  // Si false, el marcador se proyecta sin reloj de juego (solo contador y Q).
  tiene_reloj_periodo: boolean;
  // Si false, no se muestra ni opera shot clock.
  tiene_shot_clock: boolean;
  // Si false, oculta el indicador de cuarto (Q) — los nombres y puntajes
  // ocupan el espacio liberado para verse más grandes (SQL 29).
  tiene_periodo: boolean;
  // Contador monotónico que el admin incrementa para sonar la bocina remota
  // en el visor. SQL 28.
  bocina_pulsos: number;
  expira_en: string;
  creado_por: string;
  created_at: string;
};

// Calcula los ms restantes ahora para reloj o shot, evitando drift:
//   corriendo  -> restante_base - (now - inicio_ts)
//   pausado    -> restante_base
export function msRestantes(
  restanteBase: number,
  corriendo: boolean,
  inicioIso: string | null,
  ahoraMs: number = Date.now(),
): number {
  if (!corriendo || !inicioIso) return Math.max(0, restanteBase);
  const inicio = new Date(inicioIso).getTime();
  return Math.max(0, restanteBase - (ahoraMs - inicio));
}

// Formato de tiempo: MM:SS si >= 1 min; SS.t si <1 min para precisión visual.
export function formatearReloj(ms: number): string {
  const total = Math.max(0, ms);
  if (total >= 60_000) {
    const m = Math.floor(total / 60_000);
    const s = Math.floor((total % 60_000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const s = Math.floor(total / 1000);
  const d = Math.floor((total % 1000) / 100);
  return `${String(s).padStart(2, '0')}.${d}`;
}

// ---- Torneos --------------------------------------------------------------
export type EstadoTorneo =
  | 'convocados'
  | 'inscritos'
  | 'en_curso'
  | 'finalizado'
  | 'cancelado';

export type EstadoPartido =
  | 'programado'
  | 'jugado'
  | 'wo'
  | 'aplazado'
  | 'cancelado';

export type Torneo = {
  id: string;
  nombre: string;
  organizador: string | null;
  categoria_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ubicacion: string | null;
  estado: EstadoTorneo;
  posicion_final: string | null;
  notas: string | null;
  created_at: string;
};

export type Partido = {
  id: string;
  torneo_id: string;
  fecha: string;
  rival: string;
  ubicacion: string | null;
  puntos_propio: number | null;
  puntos_rival: number | null;
  estado: EstadoPartido;
  notas: string | null;
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
