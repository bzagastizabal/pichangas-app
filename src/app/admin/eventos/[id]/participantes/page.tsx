import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { baseUrl } from '@/lib/url';
import type { EstadoInscripcion, EstadoPago, TipoEvento } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { estadoPagoJugador, type EstadoPagoJugador } from '@/lib/estado-pago';
import { firmarTokenPago } from '@/lib/token-pago';
import { agregarParticipante } from './actions';
import { AccionesParticipante } from './AccionesParticipante';
import { CopiarLista } from './CopiarLista';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

const etiquetaPago: Record<EstadoPagoJugador, string> = {
  pagado: 'pagado',
  en_revision: 'en revisión',
  pendiente: 'pendiente',
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
  fecha_reserva: string;
  perfiles: { nombre_completo: string | null; telefono: string | null } | null;
  pagos: { id: string; estado: EstadoPago; monto_declarado: number; fecha_validacion: string | null }[];
};

type Evento = {
  id: string;
  tipo: TipoEvento;
  fecha_hora_evento: string;
  duracion_horas: number;
  costo_por_participante: number;
  cupos_totales: number;
  minimo_requerido: number;
  slug_inscripcion: string;
  categoria_id: string | null;
  sedes: { nombre: string; direccion: string | null; geolocalizacion: string | null } | null;
  categorias: { nombre: string } | null;
};

export default async function ParticipantesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const base = await baseUrl();

  const { data: ev } = await supabase
    .from('eventos')
    .select(
      'id, tipo, fecha_hora_evento, duracion_horas, costo_por_participante, cupos_totales, minimo_requerido, slug_inscripcion, categoria_id, sedes(nombre, direccion, geolocalizacion), categorias(nombre)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!ev) notFound();
  const evento = ev as unknown as Evento;

  const { data: insData } = await supabase
    .from('inscripciones')
    .select('id, estado, usuario_id, fecha_reserva, perfiles(nombre_completo, telefono), pagos(id, estado, monto_declarado, fecha_validacion)')
    .eq('evento_id', id)
    .order('fecha_reserva', { ascending: true });
  const inscritos = (insData as unknown as Inscrito[]) ?? [];

  const { data: todos } = await supabase
    .from('perfiles')
    .select('id, nombre_completo')
    .eq('activo', true)
    .order('nombre_completo');
  const inscritosIds = new Set(inscritos.map((i) => i.usuario_id));
  const disponibles = ((todos as { id: string; nombre_completo: string | null }[]) ?? []).filter(
    (p) => !inscritosIds.has(p.id),
  );

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

  // Para el mensaje de WhatsApp: titulo legible, items y cupos.
  const tituloEvento =
    evento.tipo === 'torneo'
      ? `Convocatoria de torneo${evento.categorias?.nombre ? ` (${evento.categorias.nombre})` : ''}`
      : evento.tipo === 'amistoso'
        ? `Amistoso en ${evento.sedes?.nombre ?? 'la cancha'}`
        : `Pichanga en ${evento.sedes?.nombre ?? 'la cancha'}`;
  const ocupados = inscritos.filter(
    (i) => i.estado === 'pendiente' || i.estado === 'confirmado',
  ).length;
  const cuposDisponibles = Math.max(0, evento.cupos_totales - ocupados);
  // Solo los que tienen cupo (pendiente/confirmado) entran a la lista
  // copiada — los de lista de espera o expirados se omiten.
  const itemsCopia = inscritos
    .filter((i) => i.estado === 'pendiente' || i.estado === 'confirmado')
    .map((i) => ({
      nombre: i.perfiles?.nombre_completo ?? 'Jugador',
      telefono: i.perfiles?.telefono ?? null,
      estado: estadoDe(i),
    }));

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

      <CopiarLista
        titulo={tituloEvento}
        sedeNombre={evento.sedes?.nombre ?? 'Cancha'}
        sedeDireccion={evento.sedes?.direccion ?? null}
        sedeMapa={evento.sedes?.geolocalizacion ?? null}
        fechaIso={evento.fecha_hora_evento}
        duracionHoras={evento.duracion_horas}
        costo={evento.costo_por_participante}
        cuposTotales={evento.cupos_totales}
        cuposDisponibles={cuposDisponibles}
        inscribirUrl={`${base}/inscribir/${evento.slug_inscripcion}`}
        items={itemsCopia}
      />

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

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full text-sm">
          <thead className="bg-fondo text-left text-tenue">
            <tr>
              <th className="p-3">Jugador</th>
              <th className="p-3">Inscripción</th>
              <th className="p-3">Pago</th>
              <th className="p-3">Inscrito</th>
              <th className="p-3 text-right">Monto</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inscritos.map((i) => {
              const ep = estadoDe(i);
              const aprobado = i.pagos.find((p) => p.estado === 'aprobado');
              const enRevision = i.pagos.find((p) => p.estado === 'en_revision');
              const linkPago = `${base}/pagar/${firmarTokenPago(i.id)}`;
              const waMensaje =
                `Hola ${i.perfiles?.nombre_completo ?? ''} 👋 Te apuntamos a la pichanga en ` +
                `${evento.sedes?.nombre ?? ''} el ${formatearFechaLima(evento.fecha_hora_evento)}. ` +
                `Confirma tu cupo subiendo tu pago (${soles.format(evento.costo_por_participante)}) aquí: ` +
                `${linkPago}`;
              return (
                <tr key={i.id} className="border-t border-borde align-top">
                  <td className="p-3">
                    <p className="font-medium">{i.perfiles?.nombre_completo ?? 'Jugador'}</p>
                    {i.perfiles?.telefono && (
                      <p className="text-xs text-tenue">{i.perfiles.telefono}</p>
                    )}
                  </td>
                  <td className="p-3 text-tenue">{i.estado}</td>
                  <td className={`p-3 ${colorPago[ep]}`}>{etiquetaPago[ep]}</td>
                  <td className="p-3 text-tenue">{formatearFechaLima(i.fecha_reserva)}</td>
                  <td className="p-3 text-right">
                    {aprobado ? soles.format(aprobado.monto_declarado) : '—'}
                  </td>
                  <td className="p-3">
                    <AccionesParticipante
                      inscripcionId={i.id}
                      usuarioId={i.usuario_id}
                      nombre={i.perfiles?.nombre_completo ?? 'Jugador'}
                      telefono={i.perfiles?.telefono}
                      linkPago={linkPago}
                      waMensaje={waMensaje}
                      montoSugerido={evento.costo_por_participante}
                      pagoEnRevisionId={enRevision?.id ?? null}
                      tienePagoVivo={Boolean(aprobado || enRevision)}
                    />
                  </td>
                </tr>
              );
            })}
            {inscritos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-tenue">
                  Aún no hay participantes. Agrega uno arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
