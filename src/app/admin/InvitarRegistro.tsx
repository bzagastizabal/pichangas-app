'use client';

import { useState } from 'react';
import { linkWa } from '@/lib/wa';
import { TelefonoInput } from '@/components/TelefonoInput';

// Invita por WhatsApp a un teléfono a registrarse en el sistema.
export function InvitarRegistro({ base }: { base: string }) {
  const [tel, setTel] = useState('');
  const mensaje =
    `¡Hola! Te invitamos a registrarte en el sistema de pichangas CMT 🏀\n` +
    `Crea tu cuenta aquí: ${base}/registro`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-tenue mb-1">Teléfono (WhatsApp)</label>
        <TelefonoInput onChange={setTel} />
      </div>
      <a
        href={linkWa(tel, mensaje)}
        target="_blank"
        rel="noopener noreferrer"
        className={`rounded px-3 py-2 text-sm text-white ${tel ? 'bg-green-600' : 'bg-white/10 pointer-events-none text-tenue'}`}
      >
        Invitar por WhatsApp
      </a>
    </div>
  );
}
