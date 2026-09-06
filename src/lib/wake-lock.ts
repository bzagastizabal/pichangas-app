// src/lib/wake-lock.ts
// Mantiene la pantalla encendida mientras el marcador está proyectado.
//
// Usa Screen Wake Lock API (Chrome/Edge/Android 84+, Safari 16.4+). El
// sentinel se libera SOLO cuando el navegador cambia de pestaña, se minimiza
// o bloquea la pantalla: por eso re-pedimos en cada 'visibilitychange'.
// Algunos navegadores exigen activación del usuario para el primer request;
// en ese caso el hook queda en 'bloqueado' y el UI ofrece reintentar con un
// toque (el click ya es el gesto que falta).
'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type EstadoPantalla =
  | 'inactivo'      // apagado por el usuario o lock soltado por el navegador
  | 'activo'        // wake lock vigente: la pantalla no se apaga
  | 'bloqueado'     // el navegador pidió un gesto o denegó el permiso
  | 'no_soportado'; // navegador sin Screen Wake Lock (iOS < 16.4, Firefox viejo)

type NavegadorConWakeLock = Navigator & {
  wakeLock?: { request: (tipo: 'screen') => Promise<WakeLockSentinel> };
};

// El soporte no cambia en runtime: subscribe vacío. getServerSnapshot=false
// evita el desajuste de hidratación (en el server no hay `navigator`).
const sinCambios = () => () => {};
const haySoporteCliente = () =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator;

// `activo` enciende/apaga el bloqueo. Devuelve el estado y un `reintentar`
// para colgar de un onClick (gesto del usuario) cuando quedó 'bloqueado'.
export function useMantenerPantalla(activo: boolean): {
  estado: EstadoPantalla;
  reintentar: () => void;
} {
  const soporta = useSyncExternalStore(sinCambios, haySoporteCliente, () => false);
  const [estadoLock, setEstadoLock] = useState<'inactivo' | 'activo' | 'bloqueado'>('inactivo');
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  // Cambia en cada reintento manual para re-disparar el efecto.
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    if (!activo || !soporta) return;
    const nav = navigator as NavegadorConWakeLock;
    let cancelado = false;

    async function pedir() {
      // El request falla si el documento no está visible: esperamos al
      // siguiente visibilitychange en vez de marcar error.
      if (document.visibilityState !== 'visible') return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const s = await nav.wakeLock!.request('screen');
        if (cancelado) {
          void s.release().catch(() => {});
          return;
        }
        sentinelRef.current = s;
        // El navegador lo suelta al ocultar la pestaña; lo reflejamos para
        // que el indicador no mienta (al volver, visibilitychange re-pide).
        s.addEventListener('release', () => {
          if (sentinelRef.current === s) sentinelRef.current = null;
          if (!cancelado) setEstadoLock((prev) => (prev === 'activo' ? 'inactivo' : prev));
        });
        setEstadoLock('activo');
      } catch {
        // NotAllowedError: falta gesto del usuario o el SO lo impide.
        if (!cancelado) setEstadoLock('bloqueado');
      }
    }

    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir();
    };
    void pedir();
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', alVolver);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [activo, soporta, intento]);

  const estado: EstadoPantalla = !activo
    ? 'inactivo'
    : !soporta
      ? 'no_soportado'
      : estadoLock;

  return { estado, reintentar };
}
