// src/app/login/page.tsx
// Página de LOGIN. Inicia sesión contra Supabase Auth.
// Respeta ?next=... para volver a la página de origen (p. ej. un enlace de
// inscripción) tras autenticarse.
'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MarcaClub } from '@/components/MarcaClub';
import { emailPorDni } from './actions';

const campo = 'border border-borde p-2 w-full rounded bg-campo text-texto';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const supabase = createClient();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    setCargando(true);
    setMensaje('');

    // Permite entrar con correo, DNI o teléfono (resuelve el correo en el server).
    let correo = usuario.trim();
    if (!correo.includes('@')) {
      const e = await emailPorDni(correo);
      if (!e) {
        setCargando(false);
        setMensaje('No se encontró ese DNI ni teléfono.');
        return;
      }
      correo = e;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: correo, password });

    setCargando(false);
    if (error) {
      setMensaje('Error: ' + error.message);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 space-y-4">
      <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-20 w-auto mx-auto" />
      <MarcaClub />
      <h1 className="text-2xl font-bold text-center">Iniciar sesión</h1>
      <input className={campo} type="text" placeholder="Correo, DNI o teléfono"
        value={usuario} onChange={(e) => setUsuario(e.target.value)} />
      <input className={campo} type="password" placeholder="Contraseña"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin} disabled={cargando}
        className="bg-orange-600 text-white p-2 w-full rounded disabled:opacity-50">
        {cargando ? 'Entrando...' : 'Entrar'}
      </button>
      {mensaje && <p className="text-sm">{mensaje}</p>}

      <div className="rounded-lg border border-borde p-4 space-y-2 text-center">
        <p className="text-sm text-tenue">¿Aún no eres parte del club?</p>
        <Link
          href={`/registro?next=${encodeURIComponent(next)}`}
          className="inline-block w-full border border-orange-600 text-orange-400 hover:bg-orange-600/10 py-2 rounded font-medium"
        >
          Regístrate
        </Link>
        <p className="text-xs text-tenue">
          Mira las{' '}
          <Link href="/ayuda" className="text-orange-400 hover:underline">
            pautas y guía rápida
          </Link>{' '}
          antes de crear tu cuenta.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requiere un límite de Suspense.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
