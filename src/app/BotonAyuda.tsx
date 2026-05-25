'use client';

import { useState } from 'react';
import Link from 'next/link';
import { STAFF } from '@/lib/staff';
import { linkWa } from '@/lib/wa';

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
          <a
            href={linkWa(STAFF.whatsapp, 'Hola, necesito ayuda con las pichangas CMT 🏀')}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded bg-green-600 px-3 py-2 text-center text-sm text-white"
          >
            Escribir al staff por WhatsApp
          </a>
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
