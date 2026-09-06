// src/components/BotonPantalla.tsx
// Interruptor de "mantener la pantalla encendida" (Screen Wake Lock). Se usa
// en el visor del marcador y en el panel de control: en ambos la pantalla no
// debe apagarse mientras el partido corre.
'use client';

import type { EstadoPantalla } from '@/lib/wake-lock';

// Botón de "mantener pantalla encendida" (Screen Wake Lock). Estados:
// activo = la pantalla no se apaga; inactivo = el usuario lo apagó o el
// navegador soltó el lock; bloqueado = falta un gesto (el propio click lo da);
// no_soportado = navegador viejo, se explica en el title.
export function BotonPantalla({
  estado,
  activo,
  onToggle,
  onReintentar,
  tam = 'normal',
}: {
  estado: EstadoPantalla;
  activo: boolean;
  onToggle: () => void;
  onReintentar: () => void;
  tam?: 'normal' | 'grande';
}) {
  const encendido = estado === 'activo';
  const h = tam === 'grande' ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-9 w-9';
  const titulo =
    estado === 'activo'
      ? 'La pantalla se mantiene encendida — toca para permitir que se apague'
      : estado === 'bloqueado'
        ? 'Toca para mantener la pantalla encendida'
        : estado === 'no_soportado'
          ? 'Este navegador no puede evitar que la pantalla se apague (usa Chrome, o desactiva el bloqueo automático en el sistema)'
          : 'Mantener la pantalla encendida';
  return (
    <button
      type="button"
      onClick={() => {
        if (estado === 'bloqueado' && activo) onReintentar();
        else onToggle();
      }}
      aria-label={titulo}
      title={titulo}
      className={`inline-flex ${h} items-center justify-center rounded-full ring-1 transition ${
        encendido
          ? 'bg-amber-400/20 ring-amber-300/50 text-amber-200'
          : estado === 'bloqueado'
            ? 'bg-red-500/15 ring-red-400/40 text-red-200 animate-pulse'
            : 'bg-white/5 ring-white/15 text-zinc-400 hover:bg-white/10'
      }`}
    >
      <span className="text-base">{encendido ? '💡' : '🌙'}</span>
    </button>
  );
}
