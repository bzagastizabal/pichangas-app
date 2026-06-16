'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// Resuelve el correo desde un identificador: DNI o número de teléfono.
// Prueba DNI primero (match exacto). Si no, prueba teléfono normalizado a
// dígitos, asumiendo Perú (+51) cuando son 9 dígitos.
export async function emailPorIdentificador(input: string): Promise<string | null> {
  const dig = input.replace(/\D/g, '');
  if (!dig) return null;
  const admin = createAdminClient();

  // 1) DNI exacto
  const { data: porDni } = await admin
    .from('perfiles')
    .select('id')
    .eq('dni', dig)
    .maybeSingle();
  if (porDni) {
    const { data: u } = await admin.auth.admin.getUserById(porDni.id);
    return u?.user?.email ?? null;
  }

  // 2) Teléfono: probamos el valor crudo y la versión con prefijo 51 si vino sin
  const candidatos = dig.length === 9 ? [dig, '51' + dig] : [dig];
  for (const tel of candidatos) {
    const { data: porTel } = await admin
      .from('perfiles')
      .select('id')
      .eq('telefono', tel)
      .maybeSingle();
    if (porTel) {
      const { data: u } = await admin.auth.admin.getUserById(porTel.id);
      return u?.user?.email ?? null;
    }
  }
  return null;
}

// Alias retro-compatible para no romper otros importadores.
export const emailPorDni = emailPorIdentificador;
