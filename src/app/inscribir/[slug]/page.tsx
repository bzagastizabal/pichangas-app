// src/app/inscribir/[slug]/page.tsx
// Página pública de inscripción (enlace directo por slug). Requiere sesión:
// la RLS no deja a un anónimo ver el evento, así que invitamos a iniciar sesión.
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getSesion } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EstadoInscripcion, Evento, Inscripcion, Pago } from '@/lib/types';
import { formatearFechaLima } from '@/lib/fechas';
import { linkGoogleCalendar } from '@/lib/calendario';
import { Pista } from '@/components/Pista';
import { MarcaClub } from '@/components/MarcaClub';
import { BannerMarchaBlanca } from '@/components/BannerMarchaBlanca';
import { BotonInscribirse } from './BotonInscribirse';
import { DestinoPago } from './DestinoPago';
import { FormComprobante } from './FormComprobante';

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

type EventoPublico = Evento & {
  sedes: { nombre: string; direccion: string | null; geolocalizacion: string | null } | null;
};

const tarjeta = 'max-w-md mx-auto mt-12 p-6 rounded-xl border border-borde bg-tarjeta space-y-4';

// Metadata por evento: para que la previsualizacion en WhatsApp muestre sede y
// fecha en vez del titulo generico. Se usa el cliente admin (service-role)
// porque el bot que arma el preview no tiene sesion y la RLS lo bloquearia.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from('eventos')
    .select('fecha_hora_evento, costo_por_participante, sedes(nombre)')
    .eq('slug_inscripcion', slug)
    .maybeSingle();

  if (!data) {
    return {
      title: 'Pichanga — CMT BasketBall Club',
      description:
        'Inscríbete a las pichangas del CMT BasketBall Club (Clorinda Matto de Turner).',
    };
  }

  const sede = (data.sedes as { nombre?: string } | null)?.nombre ?? 'cancha';
  const fecha = formatearFechaLima(data.fecha_hora_evento);
  const costo = soles.format(Number(data.costo_por_participante));
  const titulo = `Pichanga en ${sede} 🏀`;
  const descripcion = `${fecha} · Costo ${costo}. Reserva tu cupo con el CMT BasketBall Club.`;
  return {
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion },
    twitter: { title: titulo, description: descripcion },
  };
}

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
        <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-16 w-auto mx-auto" />
        <MarcaClub />
        <BannerMarchaBlanca />
        <h1 className="text-xl font-bold">Inscríbete a la pichanga 🏀</h1>
        <p className="text-sm text-tenue">
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
            className="flex-1 text-center border border-borde py-2 rounded"
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
        <p className="text-sm text-tenue">
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

  // Cupos ocupados (pendiente + confirmado) — vía service-role para contar todo.
  const admin = createAdminClient();
  const { count: ocupados } = await admin
    .from('inscripciones')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .in('estado', ['pendiente', 'confirmado']);
  const disponibles = Math.max(0, evento.cupos_totales - (ocupados ?? 0));

  return (
    <div className={tarjeta}>
      <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-16 w-auto mx-auto" />
      <MarcaClub />
      <div>
        <h1 className="text-xl font-bold">{evento.sedes?.nombre ?? 'Pichanga'} 🏀</h1>
        <p className="text-sm text-tenue">
          {formatearFechaLima(evento.fecha_hora_evento)}
        </p>
        {evento.sedes?.direccion && (
          <p className="text-sm text-tenue">{evento.sedes.direccion}</p>
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

      <div className="rounded-lg bg-fondo p-4 text-sm space-y-1">
        <p>
          Costo por jugador:{' '}
          <span className="font-bold text-orange-400">
            {soles.format(evento.costo_por_participante)}
          </span>
        </p>
        <p className="text-tenue">
          Límite de pago: {formatearFechaLima(evento.fecha_hora_limite_pago)}
        </p>
        <p className="text-tenue">
          Cupos: <span className="text-texto font-medium">{disponibles}</span> disponibles
          de {evento.cupos_totales}
          {disponibles === 0 && <span className="text-amber-400"> · lleno (lista de espera)</span>}
          <Pista texto="Se cuentan los cupos reservados y pagados. Si está lleno, quedas en lista de espera y entras si se libera uno." />
        </p>
      </div>

      <EstadoInscripcionVista
        inscripcion={inscripcion}
        evento={evento}
        pago={pago}
      />

      <Link href="/dashboard" className="block text-center text-sm text-tenue hover:text-orange-600">
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
  const cal = linkGoogleCalendar({
    titulo: `Pichanga · ${evento.sedes?.nombre ?? ''}`,
    inicioISO: evento.fecha_hora_evento,
    duracionHoras: evento.duracion_horas,
    ubicacion: evento.sedes?.direccion ?? evento.sedes?.nombre ?? '',
  });
  const botonCalendario = (
    <a
      href={cal}
      target="_blank"
      rel="noopener noreferrer"
      className="block text-center text-sm text-orange-500 hover:underline"
    >
      📅 Agregar a Google Calendar
    </a>
  );

  if (inscripcion) {
    if (inscripcion.estado === 'confirmado') {
      // Solo decimos "tu pago fue aprobado" si REALMENTE hay un pago aprobado.
      // Cuando el admin inscribe a alguien manualmente queda confirmado sin un
      // pago (p. ej. pagó en efectivo) y el mensaje genérico es más honesto.
      const pagoAprobado = pago?.estado === 'aprobado';
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-center">
            <Image
              src="/cmt_insignia.png"
              alt="CMT Basquetball Club"
              width={1500}
              height={1500}
              className="h-28 w-auto mx-auto mb-2"
            />
            <p className="font-medium text-blue-800">🎉 Inscripción confirmada.</p>
            <p className="text-blue-700">
              {pagoAprobado
                ? 'Tu pago fue aprobado. ¡Nos vemos en la cancha!'
                : '¡Nos vemos en la cancha!'}
            </p>
          </div>
          {botonCalendario}
        </div>
      );
    }

    if (inscripcion.estado === 'lista_espera') {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-800">
              ⏳ Estás en lista de espera
              {inscripcion.posicion_lista ? ` (puesto ${inscripcion.posicion_lista})` : ''}.
            </p>
            <p className="text-amber-700">
              Puedes pagar ahora para adelantarte: <strong>el que paga primero gana</strong> el cupo.
            </p>
          </div>
          {pago && pago.estado === 'en_revision' ? (
            <p className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
              📤 Comprobante en revisión. Si tu pago es de los más antiguos, tomarás un cupo.
            </p>
          ) : (
            <>
              {pago && pago.estado === 'rechazado' && (
                <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Tu comprobante anterior fue rechazado
                  {pago.motivo_rechazo ? `: ${pago.motivo_rechazo}` : ''}. Sube uno nuevo.
                </p>
              )}
              <DestinoPago
                titular={evento.pago_titular ?? null}
                telefono={evento.pago_telefono ?? null}
                monto={evento.costo_por_participante}
              />
              <FormComprobante
                inscripcionId={inscripcion.id}
                montoSugerido={evento.costo_por_participante}
              />
            </>
          )}
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
          <DestinoPago
            titular={evento.pago_titular ?? null}
            telefono={evento.pago_telefono ?? null}
            monto={evento.costo_por_participante}
          />
          <FormComprobante
            inscripcionId={inscripcion.id}
            montoSugerido={evento.costo_por_participante}
          />
          {botonCalendario}
        </div>
      );
    }

    // expirado / liberado
    const otros: Record<EstadoInscripcion, React.ReactNode> = {
      pendiente: null,
      confirmado: null,
      lista_espera: null,
      expirado: <p className="text-sm text-tenue">Tu reserva anterior expiró.</p>,
      liberado: <p className="text-sm text-tenue">Tu cupo fue liberado.</p>,
    };
    return <>{otros[inscripcion.estado]}</>;
  }

  if (evento.estado !== 'abierta') {
    return (
      <p className="rounded-lg bg-fondo p-4 text-sm text-tenue">
        Las inscripciones para este evento están cerradas.
      </p>
    );
  }

  return <BotonInscribirse eventoId={evento.id} />;
}
