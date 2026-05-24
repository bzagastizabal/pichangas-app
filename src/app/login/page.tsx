// src/app/login/page.tsx
// Página de LOGIN. Inicia sesión contra Supabase Auth.
// Respeta ?next=... para volver a la página de origen (p. ej. un enlace de
// inscripción) tras autenticarse.
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    setCargando(true);
    setMensaje('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

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
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <input className="border p-2 w-full rounded" type="email" placeholder="Correo"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="border p-2 w-full rounded" type="password" placeholder="Contraseña"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin} disabled={cargando}
        className="bg-orange-600 text-white p-2 w-full rounded disabled:opacity-50">
        {cargando ? 'Entrando...' : 'Entrar'}
      </button>
      {mensaje && <p className="text-sm">{mensaje}</p>}
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
