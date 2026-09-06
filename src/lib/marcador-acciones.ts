// src/lib/marcador-acciones.ts
// Acciones del reloj disparadas DESDE EL NAVEGADOR contra la RPC atómica
// `marcador_reloj` (SQL 38), en vez de pasar por un Server Action.
//
// Por qué: el Server Action agrega el salto extra teléfono → Vercel → Supabase
// y, al terminar, Next refresca el RSC de la ruta. Con muchos toques seguidos
// eso se encolaba y el reset se sentía lento. Desde el navegador es UNA
// llamada a Supabase (~100 ms) y la RPC devuelve la fila ya resuelta, que el
// cliente aplica como verdad. La barrera sigue siendo es_admin() dentro de la
// RPC + RLS: nadie sin rol administrador puede moverla.
'use client';

import { createClient } from '@/lib/supabase/client';
import {
  ajustarCronometro,
  resetReloj,
  togglePlay,
} from '@/app/admin/marcadores/[id]/control/actions';
import type { Marcador } from '@/lib/types';

export type AccionReloj = 'play' | 'reset' | 'ajuste';

export async function accionReloj(
  id: string,
  accion: AccionReloj,
  deltaSeg = 0,
): Promise<Marcador | null> {
  const { data, error } = await createClient().rpc('marcador_reloj', {
    p_id: id,
    p_accion: accion,
    p_delta: deltaSeg,
  });
  if (error || !data) {
    // SQL 38 sin correr (o RPC caída): respaldo por Server Action. No devuelve
    // fila; el estado se reconcilia igual por postgres_changes.
    await respaldoServerAction(id, accion, deltaSeg);
    return null;
  }
  return data as Marcador;
}

async function respaldoServerAction(
  id: string,
  accion: AccionReloj,
  deltaSeg: number,
): Promise<void> {
  const fd = new FormData();
  fd.set('id', id);
  if (accion === 'play') return togglePlay(fd);
  if (accion === 'reset') return resetReloj(fd);
  fd.set('delta', String(deltaSeg));
  return ajustarCronometro(fd);
}

// Aplica la fila que devolvió el servidor solo si es más nueva que la que ya
// tenemos. `rev` lo incrementa un trigger en cada UPDATE, así un payload
// atrasado (Realtime lento) no pisa un estado más reciente.
export function masNuevo(previo: Marcador, entrante: Marcador): boolean {
  const a = previo.rev ?? 0;
  const b = entrante.rev ?? 0;
  if (!a || !b) return true; // sin SQL 38 todavía: nos quedamos con lo último.
  return b >= a;
}
