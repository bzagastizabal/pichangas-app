import Image from 'next/image';
import Link from 'next/link';
import { ContactosStaff } from '@/components/ContactosStaff';

const paso = 'rounded-lg border border-borde p-4';

export default function AyudaPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-2">
        <Image src="/cmt_logo.png" alt="CMT" width={900} height={1000} priority className="h-16 w-auto mx-auto" />
        <h1 className="text-2xl font-bold">Cómo funciona 🏀</h1>
        <p className="text-sm text-tenue">Guía rápida para unirte a las pichangas.</p>
      </div>

      <div className={paso}>
        <h2 className="font-semibold">1. Entra a tu cuenta</h2>
        <p className="text-sm text-tenue mt-1">
          Ingresa con tu <strong>DNI o correo</strong> y tu contraseña. Si el staff
          te creó la cuenta, tu <strong>contraseña inicial es tu DNI</strong> (puedes
          cambiarla luego en “Cambiar contraseña”). ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-orange-500 hover:underline">Regístrate</Link>.
        </p>
      </div>

      <div className={paso}>
        <h2 className="font-semibold">2. Únete a una pichanga</h2>
        <p className="text-sm text-tenue mt-1">
          En tu inicio verás <strong>“Próximas pichangas”</strong>. Toca
          <strong> Inscribirme</strong> en la que quieras. Si hay cupo quedarás como
          <strong> pendiente de pago</strong>; si está lleno, entrarás a
          <strong> lista de espera</strong>.
        </p>
      </div>

      <div className={paso}>
        <h2 className="font-semibold">3. Paga y sube tu comprobante</h2>
        <p className="text-sm text-tenue mt-1">
          Paga por Yape/Plin/transferencia y <strong>sube la foto del comprobante</strong>
          {' '}desde la página de la pichanga o desde el <strong>link de pago</strong> que
          te comparta el staff por WhatsApp. El admin lo valida y tu cupo queda
          <strong> confirmado</strong>.
        </p>
      </div>

      <div className={paso}>
        <h2 className="font-semibold">¿Qué significan los estados?</h2>
        <ul className="text-sm text-tenue mt-1 space-y-1">
          <li><span className="text-amber-400">Pendiente</span>: reservaste, falta pagar.</li>
          <li><span className="text-sky-400">En revisión</span>: subiste tu pago, el staff lo valida.</li>
          <li><span className="text-green-400">Confirmado</span>: pago aprobado, ¡tienes tu cupo!</li>
          <li><span className="text-sky-400">Lista de espera</span>: entrarás si se libera un cupo (paga rápido para asegurarlo).</li>
          <li><span className="text-red-400">Moroso</span>: jugaste pero no se registró tu pago.</li>
        </ul>
      </div>

      <div className={paso}>
        <h2 className="font-semibold mb-2">¿Sigues con dudas? Contacta al staff</h2>
        <ContactosStaff />
      </div>

      <Link href="/dashboard" className="block text-center text-sm text-tenue hover:text-orange-600">
        ← Volver al inicio
      </Link>
    </div>
  );
}
