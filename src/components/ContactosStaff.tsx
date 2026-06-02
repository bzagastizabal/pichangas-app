'use client';

import { useEffect, useState } from 'react';
import { STAFF } from '@/lib/staff';
import { urlPublica } from '@/lib/storage';
import { linkWa } from '@/lib/wa';

type Contacto = {
  id: string;
  nombre: string;
  cargo: string | null;
  whatsapp: string | null;
  foto_url: string | null;
};

const MENSAJE = 'Hola, necesito ayuda con las pichangas CMT 🏀';

// Lista los contactos del staff (vía /api/staff, con RLS por sesión).
// Si no hay datos, cae al contacto por defecto de src/lib/staff.ts.
export function ContactosStaff() {
  const [items, setItems] = useState<Contacto[] | null>(null);

  useEffect(() => {
    fetch('/api/staff')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Contacto[]) => setItems(d))
      .catch(() => setItems([]));
  }, []);

  if (items === null) return <p className="text-xs text-tenue">Cargando contactos…</p>;

  const lista: Contacto[] =
    items.length > 0
      ? items
      : [
          {
            id: 'default',
            nombre: STAFF.nombre,
            cargo: null,
            whatsapp: STAFF.whatsapp,
            foto_url: null,
          },
        ];

  return (
    <div className="space-y-2">
      {lista.map((c) => (
        <a
          key={c.id}
          href={linkWa(c.whatsapp, MENSAJE)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded border border-borde px-3 py-2 text-sm hover:border-green-500"
        >
          {c.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlPublica('staff_fotos', c.foto_url)}
              alt={c.nombre}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-campo text-tenue text-sm">
              {(c.nombre || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="flex-1">
            <span className="font-medium">{c.nombre}</span>
            {c.cargo ? <span className="text-tenue"> · {c.cargo}</span> : null}
          </span>
          <span className="text-green-400">WhatsApp</span>
        </a>
      ))}
    </div>
  );
}
