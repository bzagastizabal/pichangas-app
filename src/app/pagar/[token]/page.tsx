import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { verificarTokenPago } from '@/lib/token-pago';
import { formatearFechaLima } from '@/lib/fechas';
import { MarcaClub } from '@/components/MarcaClub';
import { FormVoucher } from './FormVoucher';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const tarjeta = 'max-w-md mx-auto mt-12 p-6 rounded-xl border border-borde bg-tarjeta space-y-4';

type InscPago = {
  id: string;
  perfiles: { nombre_completo: string | null } | null;
  eventos: {
    fecha_hora_evento: string;
    costo_por_participante: number;
    sedes: { nombre: string } | null;
  } | null;
  pagos: { estado: string }[];
};

export default async function PagarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const iid = verificarTokenPago(token);
  const admin = createAdminClient();
  const { data } = iid
    ? await admin
        .from('inscripciones')
        .select(
          'id, perfiles(nombre_completo), eventos(fecha_hora_evento, costo_por_participante, sedes(nombre)), pagos(estado)',
        )
        .eq('id', iid)
        .maybeSingle()
    : { data: null };
  const insc = data as unknown as InscPago | null;

  if (!insc || !insc.eventos) {
    return (
      <div className={tarjeta}>
        <h1 className="text-xl font-bold">Link no válido</h1>
        <p className="text-sm text-tenue">
          Este enlace de pago no existe o ya no está disponible. Pídele al
          organizador uno nuevo.
        </p>
      </div>
    );
  }

  const aprobado = insc.pagos.some((p) => p.estado === 'aprobado');
  const enRevision = insc.pagos.some((p) => p.estado === 'en_revision');
  const monto = insc.eventos.costo_por_participante;

  return (
    <div className={tarjeta}>
      <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-16 w-auto mx-auto" />
      <MarcaClub />
      <div>
        <h1 className="text-xl font-bold">Hola, {insc.perfiles?.nombre_completo ?? 'jugador'} 🏀</h1>
        <p className="text-sm text-tenue">
          {insc.eventos.sedes?.nombre ?? 'Pichanga'} ·{' '}
          {formatearFechaLima(insc.eventos.fecha_hora_evento)}
        </p>
      </div>

      <div className="rounded-lg bg-fondo p-4 text-sm">
        Monto a pagar:{' '}
        <span className="font-bold text-orange-500">{soles.format(monto)}</span>
      </div>

      {aprobado ? (
        <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          ✅ Tu pago ya está registrado. ¡Gracias!
        </p>
      ) : enRevision ? (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-400">
          📤 Recibimos tu comprobante, está en revisión. Si necesitas, puedes
          subir otro abajo.
        </p>
      ) : (
        <p className="text-sm text-tenue">
          Sube la foto de tu Yape/Plin o transferencia para confirmar tu cupo.
        </p>
      )}

      {!aprobado && <FormVoucher token={token} montoSugerido={monto} />}
    </div>
  );
}
