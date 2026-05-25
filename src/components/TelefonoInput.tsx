'use client';

import { useState } from 'react';

const PREFIJOS = [
  { codigo: '51', label: 'Perú +51' },
  { codigo: '58', label: 'Venezuela +58' },
  { codigo: '57', label: 'Colombia +57' },
];

// Separa un número guardado (con o sin prefijo) en prefijo + resto.
function separar(valor: string | null | undefined): { pref: string; num: string } {
  const d = (valor ?? '').replace(/\D/g, '');
  for (const p of PREFIJOS) {
    if (d.startsWith(p.codigo) && d.length > p.codigo.length) {
      return { pref: p.codigo, num: d.slice(p.codigo.length) };
    }
  }
  return { pref: '51', num: d };
}

// Input de teléfono con selector de país. Guarda el número con prefijo (solo
// dígitos) en un campo oculto `name`, para que el enlace de WhatsApp salga bien.
export function TelefonoInput({
  name,
  defaultValue,
  onChange,
}: {
  name?: string;
  defaultValue?: string | null;
  onChange?: (valor: string) => void;
}) {
  const ini = separar(defaultValue);
  const [pref, setPref] = useState(ini.pref);
  const [num, setNum] = useState(ini.num);

  const digitos = num.replace(/\D/g, '');
  const combinado = digitos ? pref + digitos : '';

  function actualizar(p: string, n: string) {
    setPref(p);
    setNum(n);
    const d = n.replace(/\D/g, '');
    onChange?.(d ? p + d : '');
  }

  return (
    <div className="flex gap-2">
      {name && <input type="hidden" name={name} value={combinado} />}
      <select
        value={pref}
        onChange={(e) => actualizar(e.target.value, num)}
        className="border border-borde rounded px-2 bg-campo text-texto text-sm"
      >
        {PREFIJOS.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={num}
        onChange={(e) => actualizar(pref, e.target.value)}
        placeholder="999 999 999"
        className="flex-1 border border-borde p-2 rounded bg-campo text-texto"
      />
    </div>
  );
}
