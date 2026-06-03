// src/app/registro/page.tsx
// Página de REGISTRO. Crea el usuario en Supabase Auth y pasa
// nombre_completo + telefono en el metadata. El trigger SQL
// (on_auth_user_created) usa esos datos para crear el perfil.
// Respeta ?next=... para encadenar con un enlace de inscripción.
'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TelefonoInput } from '@/components/TelefonoInput';
import { NacionalidadInput } from '@/components/NacionalidadInput';
import { MarcaClub } from '@/components/MarcaClub';
import { BannerMarchaBlanca } from '@/components/BannerMarchaBlanca';

const campo = 'border border-borde p-2 w-full rounded bg-campo text-texto';

function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const supabase = createClient();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [nacionalidad, setNacionalidad] = useState('Peruana');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleRegistro() {
    setCargando(true);
    setMensaje('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // El trigger lee estos datos para llenar el perfil (incl. dni).
        data: { nombre_completo: nombre, telefono, dni },
      },
    });

    if (error) {
      setCargando(false);
      setMensaje('Error: ' + error.message);
      return;
    }

    // El trigger crea el perfil con los datos básicos; completamos los nuevos
    // campos por update (evita modificar el trigger). El propio usuario puede
    // hacerlo porque la RLS de perfiles permite a cada uno editar el suyo.
    const uid = data.user?.id;
    if (uid) {
      await supabase
        .from('perfiles')
        .update({
          fecha_nacimiento: fechaNacimiento || null,
          nacionalidad: nacionalidad.trim() || null,
        })
        .eq('id', uid);
    }

    // Con "Confirm email" desactivado, signUp ya deja sesión iniciada.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setCargando(false);

    if (session) {
      router.push(next);
      router.refresh();
    } else {
      // Confirm email activo: hay que confirmar antes de entrar.
      setMensaje('¡Cuenta creada! Revisa tu correo para confirmar.');
      setTimeout(
        () => router.push(`/login?next=${encodeURIComponent(next)}`),
        2000,
      );
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 space-y-4">
      <Image src="/cmt_logo.png" alt="CMT BasketBall Club" width={900} height={1000} priority className="h-20 w-auto mx-auto" />
      <MarcaClub />
      <BannerMarchaBlanca />
      <h1 className="text-2xl font-bold text-center">Crear cuenta</h1>
      <input className={campo} placeholder="Nombre completo"
        value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input className={campo} placeholder="DNI"
        value={dni} onChange={(e) => setDni(e.target.value)} />
      <TelefonoInput onChange={setTelefono} />
      <label className="block text-xs text-tenue -mb-2">Fecha de nacimiento</label>
      <input className={campo} type="date"
        value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
      <label className="block text-xs text-tenue -mb-2">Nacionalidad</label>
      <NacionalidadInput defaultValue={nacionalidad} onChange={setNacionalidad} />
      <input className={campo} type="email" placeholder="Correo"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={campo} type="password" placeholder="Contraseña"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleRegistro} disabled={cargando}
        className="bg-orange-600 text-white p-2 w-full rounded disabled:opacity-50">
        {cargando ? 'Creando...' : 'Registrarme'}
      </button>
      {mensaje && <p className="text-sm">{mensaje}</p>}
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  );
}
