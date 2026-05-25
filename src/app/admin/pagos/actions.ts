// src/app/admin/pagos/actions.ts
// Server Actions del panel de aprobación de pagos. Delegan en RPCs atómicas
// (aprobar_pago / rechazar_pago) que verifican es_admin() en la BD.
'use server';

import { refresh } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { enviarEmail, correoHtml } from '@/lib/email';

type PagoCorreo = {
  inscripciones: {
    usuario_id: string;
    eventos: { sedes: { nombre: string } | null } | null;
  } | null;
};

export async function aprobarPago(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('aprobar_pago', { p_pago_id: id });

  // Correo "pago aprobado" (best-effort).
  if (!error) {
    try {
      const { data } = await supabase
        .from('pagos')
        .select('inscripciones(usuario_id, eventos(sedes(nombre)))')
        .eq('id', id)
        .maybeSingle();
      const insc = (data as unknown as PagoCorreo | null)?.inscripciones;
      if (insc?.usuario_id) {
        const admin = createAdminClient();
        const { data: u } = await admin.auth.admin.getUserById(insc.usuario_id);
        const sede = insc.eventos?.sedes?.nombre ?? 'la cancha';
        await enviarEmail({
          to: u?.user?.email,
          subject: 'Pago aprobado ✅',
          html: correoHtml('¡Pago aprobado!', [
            `Tu pago para la pichanga en <strong>${sede}</strong> fue aprobado.`,
            'Tu cupo quedó <strong>confirmado</strong>. ¡Nos vemos en la cancha! 🏀',
          ]),
        });
      }
    } catch {
      // ignorar errores de correo
    }
  }
  refresh();
}

export async function rechazarPago(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const motivo = (formData.get('motivo') as string | null) ?? '';
  const supabase = await createClient();
  await supabase.rpc('rechazar_pago', { p_pago_id: id, p_motivo: motivo });
  refresh();
}
