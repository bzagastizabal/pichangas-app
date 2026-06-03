// Selector de nacionalidad con 3 opciones predefinidas + "Otro" libre.
// Modo controlado (onChange) o de formulario (hidden input con `name`).
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  NACIONALIDADES,
  VALORES_CANONICOS,
  normalizarNacionalidad,
} from '@/lib/nacionalidad';

const campo = 'border border-borde p-2 w-full rounded bg-campo text-texto';

export function NacionalidadInput({
  name = 'nacionalidad',
  defaultValue = 'Peruana',
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  onChange?: (valor: string) => void;
}) {
  // Normaliza el valor inicial (acepta "Peru", "peruana", etc.).
  const normalizado = normalizarNacionalidad(defaultValue);
  const esCanonica = normalizado !== '' && VALORES_CANONICOS.has(normalizado);
  const [seleccion, setSeleccion] = useState<string>(
    esCanonica ? normalizado : normalizado ? 'Otro' : 'Peruana',
  );
  const [otro, setOtro] = useState<string>(esCanonica ? '' : normalizado);
  const valor = seleccion === 'Otro' ? otro.trim() || 'Otro' : seleccion;

  // onChange con ref para no requerir useCallback en el padre.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(valor);
  }, [valor]);

  return (
    <div className="space-y-2">
      <select
        value={seleccion}
        onChange={(e) => setSeleccion(e.target.value)}
        className={campo}
      >
        {NACIONALIDADES.map((n) => (
          <option key={n.valor} value={n.valor}>
            {n.etiqueta}
          </option>
        ))}
        <option value="Otro">🌎 Otro</option>
      </select>
      {seleccion === 'Otro' && (
        <input
          type="text"
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          placeholder="Especifica (ej. Argentina, Chilena…)"
          className={campo}
        />
      )}
      <input type="hidden" name={name} value={valor} />
    </div>
  );
}
