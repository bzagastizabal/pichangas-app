'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ContactosStaff } from '@/components/ContactosStaff';

// Botón flotante de ayuda (abajo a la derecha): guía + contacto del staff.
export function BotonAyuda() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-64 space-y-3 rounded-xl border border-borde bg-tarjeta p-4 shadow-xl">
          <p className="font-semibold">¿Necesitas ayuda?</p>
          <Link
            href="/ayuda"
            onClick={() => setOpen(false)}
            className="block text-sm text-orange-500 hover:underline"
          >
            📖 Cómo funciona (guía)
          </Link>
          <div>
            <p className="mb-1 text-xs text-tenue">Contacto del staff</p>
            <ContactosStaff />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ayuda"
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-orange-600 text-xl font-bold text-white shadow-lg"
      >
        {open ? '✕' : '?'}
      </button>
    </>
  );
}
