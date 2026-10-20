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
  sonarBocina,
  togglePlay,
} from '@/app/admin/marcadores/[id]/control/actions';
import type { Marcador } from '@/lib/types';

export type AccionReloj = 'play' | 'reset' | 'ajuste' | 'bocina';

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
  if (accion === 'bocina') return sonarBocina(fd);
  fd.set('delta', String(deltaSeg));
  return ajustarCronometro(fd);
}

// Operador por link público (SQL 39): se identifica con slug + clave en vez de
// sesión. La RPC valida la clave y solo acepta acciones de tiempo, así que un
// link compartido nunca puede tocar colores, avisos ni la duración total.
// Sin respaldo por Server Action: ese camino exige requireAdmin().
export async function accionRelojOp(
  slug: string,
  clave: string,
  accion: AccionReloj,
  deltaSeg = 0,
): Promise<Marcador | null> {
  const { data, error } = await createClient().rpc('marcador_reloj_op', {
    p_slug: slug,
    p_clave: clave,
    p_accion: accion,
    p_delta: deltaSeg,
  });
  if (error || !data) return null;
  return data as Marcador;
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

// ---- Efectos de sonido (SQL 40) -----------------------------------------
// El disparo va por RPC (no por broadcast) para que lo valide el servidor:
// admin por sesión, operador por clave del link. El contador que incrementa
// llega a TODOS los visores por Realtime, así suena en el que proyecta.

export async function dispararEfecto(
  marcadorId: string,
  efectoId: string,
): Promise<Marcador | null> {
  const { data, error } = await createClient().rpc('marcador_efecto', {
    p_id: marcadorId,
    p_efecto: efectoId,
  });
  if (error || !data) return null;
  return data as Marcador;
}

export async function dispararEfectoOp(
  slug: string,
  clave: string,
  efectoId: string,
): Promise<Marcador | null> {
  const { data, error } = await createClient().rpc('marcador_efecto_op', {
    p_slug: slug,
    p_clave: clave,
    p_efecto: efectoId,
  });
  if (error || !data) return null;
  return data as Marcador;
}
