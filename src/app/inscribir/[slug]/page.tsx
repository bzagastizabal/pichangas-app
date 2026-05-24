// src/app/inscribir/[slug]/page.tsx
// Página pública de inscripción (enlace directo por slug). Requiere sesión:
// la RLS no deja a un anónimo ver el evento, así que invitamos a iniciar sesión.
import Link from 'next/link';
import { getSesion } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { EstadoInscripcion, Evento, Inscripcion, Pago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { BotonInscribirse } from './BotonInscribirse';
import { FormComprobante } from './FormComprobante';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

type EventoPublico = Evento & {
  sedes: { nombre: string; direccion: string | null; geolocalizacion: string | null } | null;
};

const tarjeta = 'max-w-md mx-auto mt-12 p-6 rounded-xl border border-gray-200 space-y-4';

export default async function InscribirPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await getSesion();

  // Sin sesión: invitamos a entrar/registrarse y volver a este enlace.
  if (!user) {
    const next = `/inscribir/${slug}`;
    return (
      <div className={tarjeta}>
        <h1 className="text-xl font-bold">Inscríbete a la pichanga 🏀</h1>
        <p className="text-sm text-gray-600">
          Inicia sesión o crea tu cuenta para ver los detalles y reservar tu cupo.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="flex-1 text-center bg-orange-600 text-white py-2 rounded"
          >
            Iniciar sesión
          </Link>
          <Link
            href={`/registro?next=${encodeURIComponent(next)}`}
            className="flex-1 text-center border border-gray-300 py-2 rounded"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: eventoData } = await supabase
    .from('eventos')
    .select('*, sedes(nombre, direccion, geolocalizacion)')
    .eq('slug_inscripcion', slug)
    .maybeSingle();
  const evento = eventoData as EventoPublico | null;

  if (!evento) {
    return (
      <div className={tarjeta}>
        <h1 className="text-xl font-bold">Evento no encontrado</h1>
        <p className="text-sm text-gray-600">
          El enlace no es válido o el evento ya no está disponible.
        </p>
        <Link href="/dashboard" className="text-orange-600 hover:underline text-sm">
          ← Volver
        </Link>
      </div>
    );
  }

  // ¿El usuario ya tiene una inscripción viva en este evento?
  const { data: inscData } = await supabase
    .from('inscripciones')
    .select('*')
    .eq('evento_id', evento.id)
    .eq('usuario_id', user.id)
    .in('estado', ['pendiente', 'confirmado', 'lista_espera'])
    .maybeSingle();
  const inscripcion = inscData as Inscripcion | null;

  // Último pago de esa inscripción (si subió comprobante).
  let pago: Pago | null = null;
  if (inscripcion) {
    const { data: pagoData } = await supabase
      .from('pagos')
      .select('*')
      .eq('inscripcion_id', inscripcion.id)
      .order('fecha_subida', { ascending: false })
      .limit(1)
      .maybeSingle();
    pago = pagoData as Pago | null;
  }

  return (
    <div className={tarjeta}>
      <div>
        <h1 className="text-xl font-bold">{evento.sedes?.nombre ?? 'Pichanga'} 🏀</h1>
        <p className="text-sm text-gray-600">
          {formatearFechaLima(evento.fecha_hora_evento)}
        </p>
        {evento.sedes?.direccion && (
          <p className="text-sm text-gray-500">{evento.sedes.direccion}</p>
        )}
        {evento.sedes?.geolocalizacion && (
          <a
            href={evento.sedes.geolocalizacion}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-orange-600 hover:underline"
          >
            Ver ubicación en el mapa →
          </a>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-1">
        <p>
          Costo por jugador:{' '}
          <span className="font-bold text-orange-700">
            {soles.format(evento.costo_por_participante)}
          </span>
        </p>
        <p className="text-gray-600">
          Límite de pago: {formatearFechaLima(evento.fecha_hora_limite_pago)}
        </p>
        <p className="text-gray-600">Cupos: {evento.cupos_totales}</p>
      </div>

      <EstadoInscripcionVista
        inscripcion={inscripcion}
        evento={evento}
        pago={pago}
      />

      <Link href="/dashboard" className="block text-center text-sm text-gray-400 hover:text-orange-600">
        Volver al inicio
      </Link>
    </div>
  );
}

function EstadoInscripcionVista({
  inscripcion,
  evento,
  pago,
}: {
  inscripcion: Inscripcion | null;
  evento: EventoPublico;
  pago: Pago | null;
}) {
  if (inscripcion) {
    if (inscripcion.estado === 'confirmado') {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
          <p className="font-medium text-blue-800">🎉 Inscripción confirmada.</p>
          <p className="text-blue-700">Tu pago fue aprobado. ¡Nos vemos en la cancha!</p>
        </div>
      );
    }

    if (inscripcion.estado === 'lista_espera') {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">
            ⏳ Estás en lista de espera
            {inscripcion.posicion_lista ? ` (puesto ${inscripcion.posicion_lista})` : ''}.
          </p>
          <p className="text-amber-700">Te avisaremos si se libera un cupo.</p>
        </div>
      );
    }

    if (inscripcion.estado === 'pendiente') {
      // En revisión: comprobante subido, esperando al admin.
      if (pago && pago.estado === 'en_revision') {
        return (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
            <p className="font-medium text-sky-800">📤 Comprobante en revisión.</p>
            <p className="text-sky-700">
              Subiste tu pago de {soles.format(pago.monto_declarado)} ({pago.metodo}).
              El admin lo validará pronto.
            </p>
          </div>
        );
      }
      if (pago && pago.estado === 'aprobado') {
        return (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
            <p className="font-medium text-blue-800">✅ Pago aprobado.</p>
          </div>
        );
      }
      // Sin comprobante o rechazado: pedir (re)subida.
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="font-medium text-green-800">✅ ¡Cupo reservado!</p>
            <p className="text-green-700">
              Paga {soles.format(evento.costo_por_participante)} antes del{' '}
              {formatearFechaLima(evento.fecha_hora_limite_pago)} y sube tu comprobante.
            </p>
          </div>
          {pago && pago.estado === 'rechazado' && (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Tu comprobante anterior fue rechazado
              {pago.motivo_rechazo ? `: ${pago.motivo_rechazo}` : ''}. Sube uno nuevo.
            </p>
          )}
          <FormComprobante
            inscripcionId={inscripcion.id}
            montoSugerido={evento.costo_por_participante}
          />
        </div>
      );
    }

    // expirado / liberado
    const otros: Record<EstadoInscripcion, React.ReactNode> = {
      pendiente: null,
      confirmado: null,
      lista_espera: null,
      expirado: <p className="text-sm text-gray-500">Tu reserva anterior expiró.</p>,
      liberado: <p className="text-sm text-gray-500">Tu cupo fue liberado.</p>,
    };
    return <>{otros[inscripcion.estado]}</>;
  }

  if (evento.estado !== 'abierta') {
    return (
      <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-600">
        Las inscripciones para este evento están cerradas.
      </p>
    );
  }

  return <BotonInscribirse eventoId={evento.id} />;
}
