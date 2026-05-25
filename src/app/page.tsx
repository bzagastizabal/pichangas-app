import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/auth';

// La raíz redirige: con sesión al inicio, sin sesión al login.
export default async function Home() {
  const { user } = await getSesion();
  redirect(user ? '/dashboard' : '/login');
}
