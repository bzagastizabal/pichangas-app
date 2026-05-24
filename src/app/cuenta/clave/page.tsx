import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/auth';
import { CambiarPassword } from './CambiarPassword';

export default async function CambiarClavePage() {
  const { user } = await getSesion();
  if (!user) redirect('/login?next=/cuenta/clave');

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 space-y-4">
      <Link href="/dashboard" className="text-sm text-tenue hover:underline">
        ← Volver
      </Link>
      <h1 className="text-2xl font-bold">Cambiar mi contraseña</h1>
      <CambiarPassword />
    </div>
  );
}
