import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { EstadoInscripcion, EstadoPago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { estadoPagoJugador, type EstadoPagoJugador } from '@/lib/estado-pago';
import { aprobarPago } from '@/app/admin/pagos/actions';
import { BotonEliminar } from '@/app/admin/BotonEliminar';
import { agregarParticipante, generarLinkPago, quitarParticipante } from './actions';
import { FormPagoAdmin } from './FormPagoAdmin';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const etiquetaPago: Record<EstadoPagoJugador, string> = {
  pagado: 'pagado',
  en_revision: 'en revisión',
  pendiente: 'pago pendiente',
  moroso: 'moroso',
};
const colorPago: Record<EstadoPagoJugador, string> = {
  pagado: 'text-green-400',
  en_revision: 'text-sky-400',
  pendiente: 'text-amber-400',
  moroso: 'text-red-400',
};

type Inscrito = {
  id: string;
  estado: EstadoInscripcion;
  usuario_id: string;
  token_pago: string | null;
  fecha_reserva: string;
  perfiles: { nombre_completo: string | null; telefono: string | null } | null;
  pagos: { id: string; estado: EstadoPago; monto_declarado: number; fecha_validacion: string | null }[];
};

type Evento = {
  id: string;
  fecha_hora_evento: string;
  duracion_horas: number;
  costo_por_participante: number;
  cupos_totales: number;
  categoria_id: string | null;
  sedes: { nombre: string } | null;
  categorias: { nombre: string } | null;
};

export default async function ParticipantesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ev } = await supabase
    .from('eventos')
    .select('id, fecha_hora_evento, duracion_horas, costo_por_participante, cupos_totales, categoria_id, sedes(nombre), categorias(nombre)')
    .eq('id', id)
    .maybeSingle();
  if (!ev) notFound();
  const evento = ev as unknown as Evento;

  const { data: insData } = await supabase
    .from('inscripciones')
    .select('id, estado, usuario_id, token_pago, fecha_reserva, perfiles(nombre_completo, telefono), pagos(id, estado, monto_declarado, fecha_validacion)')
    .eq('evento_id', id)
    .order('fecha_reserva', { ascending: true });
  const inscritos = (insData as unknown as Inscrito[]) ?? [];

  const h = await headers();
  const host = h.get('host') ?? '';
  const proto = /^(localhost|127\.|192\.|10\.)/.test(host) ? 'http' : 'https';
  const base = host ? `${proto}://${host}` : '';

  // Jugadores disponibles para agregar (activos, no inscritos).
  const { data: todos } = await supabase
    .from('perfiles')
    .select('id, nombre_completo')
    .eq('activo', true)
    .order('nombre_completo');
  const inscritosIds = new Set(inscritos.map((i) => i.usuario_id));
  const disponibles = ((todos as { id: string; nombre_completo: string | null }[]) ?? []).filter(
    (p) => !inscritosIds.has(p.id),
  );

  // Si el evento tiene categoría, separamos los jugadores de esa categoría.
  let idsCategoria = new Set<string>();
  if (evento.categoria_id) {
    const { data: pc } = await supabase
      .from('perfil_categorias')
      .select('perfil_id')
      .eq('categoria_id', evento.categoria_id);
    idsCategoria = new Set(((pc as { perfil_id: string }[]) ?? []).map((x) => x.perfil_id));
  }
  const enCategoria = disponibles.filter((p) => idsCategoria.has(p.id));
  const otros = disponibles.filter((p) => !idsCategoria.has(p.id));

  const estadoDe = (i: Inscrito) =>
    estadoPagoJugador(i.estado, i.pagos, evento.fecha_hora_evento, evento.duracion_horas);
  const morosos = inscritos.filter((i) => estadoDe(i) === 'moroso').length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/eventos" className="text-sm text-tenue hover:underline">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-bold">
          Participantes · {evento.sedes?.nombre ?? 'Evento'}
        </h1>
        <p className="text-sm text-texto">
          📅 {formatearFechaLima(evento.fecha_hora_evento)} · {evento.duracion_horas} h
        </p>
        <p className="text-sm text-tenue">
          {inscritos.length} inscritos · {morosos} morosos · cupos {evento.cupos_totales}
          {evento.categorias?.nombre ? ` · categoría ${evento.categorias.nombre}` : ''}
        </p>
      </div>

      <form action={agregarParticipante} className="flex flex-wrap items-center gap-2 rounded-lg border border-borde p-4">
        <input type="hidden" name="evento_id" value={evento.id} />
        <span className="text-sm text-tenue">Agregar jugador:</span>
        <select
          name="usuario_id"
          required
          defaultValue=""
          className="border border-borde rounded px-2 py-1.5 text-sm bg-campo text-texto"
        >
          <option value="" disabled>
            Elige un jugador…
          </option>
          {enCategoria.length > 0 && (
            <optgroup label={`Categoría ${evento.categorias?.nombre ?? ''}`}>
              {enCategoria.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo ?? p.id}
                </option>
              ))}
            </optgroup>
          )}
          {enCategoria.length > 0 ? (
            <optgroup label="Otros">
              {otros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo ?? p.id}
                </option>
              ))}
            </optgroup>
          ) : (
            otros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_completo ?? p.id}
              </option>
            ))
          )}
        </select>
        <button type="submit" className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm">
          Agregar
        </button>
        {disponibles.length === 0 && (
          <span className="text-xs text-tenue">
            No hay jugadores disponibles. Crea más en “Jugadores”.
          </span>
        )}
      </form>

      <div className="space-y-3">
        {inscritos.map((i) => {
          const ep = estadoDe(i);
          const aprobado = i.pagos.find((p) => p.estado === 'aprobado');
          const enRevision = i.pagos.find((p) => p.estado === 'en_revision');
          return (
            <div key={i.id} className="rounded-lg border border-borde p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {i.perfiles?.nombre_completo ?? 'Jugador'}
                    <span className={`ml-2 text-xs rounded bg-white/5 px-2 py-0.5 ${colorPago[ep]}`}>
                      {etiquetaPago[ep]}
                    </span>
                  </p>
                  <p className="text-xs text-tenue">
                    {i.estado}
                    {i.perfiles?.telefono ? ` · ${i.perfiles.telefono}` : ''}
                    {' · inscrito '}{formatearFechaLima(i.fecha_reserva)}
                    {aprobado?.fecha_validacion
                      ? ` · confirmado ${formatearFechaLima(aprobado.fecha_validacion)}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {aprobado && (
                    <span className="text-sm text-green-400">
                      {soles.format(aprobado.monto_declarado)}
                    </span>
                  )}
                  <BotonEliminar
                    action={quitarParticipante}
                    id={i.id}
                    nombre={i.perfiles?.nombre_completo ?? 'este participante'}
                  />
                </div>
              </div>

              {enRevision && (
                <form action={aprobarPago} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={enRevision.id} />
                  <span className="text-sm text-sky-400">
                    comprobante en revisión ({soles.format(enRevision.monto_declarado)})
                  </span>
                  <button type="submit" className="text-sm bg-green-600 text-white px-3 py-1 rounded">
                    Aprobar
                  </button>
                </form>
              )}

              {!aprobado && !enRevision && (
                <FormPagoAdmin
                  inscripcionId={i.id}
                  usuarioId={i.usuario_id}
                  montoSugerido={evento.costo_por_participante}
                />
              )}

              <div className="text-xs text-tenue">
                {i.token_pago ? (
                  <span>
                    Link de pago:{' '}
                    <code className="bg-fondo px-1 rounded break-all">
                      {base}/pagar/{i.token_pago}
                    </code>
                  </span>
                ) : (
                  <form action={generarLinkPago}>
                    <input type="hidden" name="inscripcion_id" value={i.id} />
                    <button type="submit" className="text-orange-600 hover:underline">
                      Generar link de pago
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {inscritos.length === 0 && (
          <p className="text-tenue">Aún no hay participantes. Agrega uno arriba.</p>
        )}
      </div>
    </div>
  );
}
