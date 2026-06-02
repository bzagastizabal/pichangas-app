'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EstadoForm } from '@/lib/types';

// Crea la cuenta del jugador (para quienes no pueden registrarse solos).
// El trigger on_auth_user_created arma el perfil con el metadata.
export async function crearJugador(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireAdmin();
  const nombre = (formData.get('nombre_completo') as string | null)?.trim() ?? '';
  const dni = (formData.get('dni') as string | null)?.trim() ?? '';
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? '';
  const fechaNac = (formData.get('fecha_nacimiento') as string | null)?.trim() || null;
  const nacionalidad = (formData.get('nacionalidad') as string | null)?.trim() || null;
  const emailRaw = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const passRaw = (formData.get('password') as string | null)?.trim() ?? '';

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!dni) return { error: 'El DNI es obligatorio.' };

  // Sin correo: sintetizamos uno a partir del DNI (login será por DNI).
  const email = emailRaw || `${dni}@jugador.cmt`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'El correo no es válido.' };
  }
  const password = passRaw || dni;
  if (password.length < 6) {
    return { error: 'La clave (o el DNI) debe tener al menos 6 caracteres.' };
  }

  const admin = createAdminClient();
  const { data: dup } = await admin.from('perfiles').select('id').eq('dni', dni).maybeSingle();
  if (dup) return { error: `Ya existe un jugador con DNI ${dni}.` };

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { nombre_completo: nombre, telefono, dni },
  });
  if (error) return { error: 'No se pudo crear el jugador: ' + error.message };

  // El trigger crea el perfil con los datos básicos; completamos los nuevos
  // campos por update aparte para no tener que tocar el trigger.
  if (created?.user?.id && (fechaNac || nacionalidad)) {
    await admin
      .from('perfiles')
      .update({ fecha_nacimiento: fechaNac, nacionalidad })
      .eq('id', created.user.id);
  }

  refresh();
  return {};
}

// Edita el jugador (nombre, teléfono, DNI, activo, clave) y reemplaza categorías.
export async function guardarJugador(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const nombre = ((formData.get('nombre_completo') as string) || '').trim();
  const telefono = ((formData.get('telefono') as string) || '').trim() || null;
  const dni = ((formData.get('dni') as string) || '').trim() || null;
  const fechaNac = ((formData.get('fecha_nacimiento') as string) || '').trim() || null;
  const nacionalidad = ((formData.get('nacionalidad') as string) || '').trim() || null;
  const password = ((formData.get('password') as string) || '').trim();
  const activo = formData.get('activo') === 'on';
  const categorias = formData.getAll('categorias').map((c) => String(c));

  const admin = createAdminClient();

  // DNI único (excluyendo a este mismo jugador).
  if (dni) {
    const { data: dup } = await admin
      .from('perfiles')
      .select('id')
      .eq('dni', dni)
      .neq('id', id)
      .maybeSingle();
    if (dup) {
      redirect(`/admin/jugadores/${id}/editar?error=` + encodeURIComponent(`El DNI ${dni} ya está en uso.`));
    }
  }

  if (password) {
    if (password.length < 6) {
      redirect(`/admin/jugadores/${id}/editar?error=` + encodeURIComponent('La clave debe tener al menos 6 caracteres.'));
    }
    await admin.auth.admin.updateUserById(id, { password });
  }

  await admin
    .from('perfiles')
    .update({
      nombre_completo: nombre,
      telefono,
      dni,
      fecha_nacimiento: fechaNac,
      nacionalidad,
      activo,
    })
    .eq('id', id);

  // Reemplaza el set de categorías del jugador.
  await admin.from('perfil_categorias').delete().eq('perfil_id', id);
  if (categorias.length > 0) {
    await admin
      .from('perfil_categorias')
      .insert(categorias.map((categoria_id) => ({ perfil_id: id, categoria_id })));
  }

  redirect('/admin/jugadores');
}

// Reinicia la contraseña del jugador a su DNI (clave por defecto).
export async function reiniciarPassword(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const admin = createAdminClient();
  const { data } = await admin.from('perfiles').select('dni').eq('id', id).maybeSingle();
  const dni = (data?.dni ?? '').trim();
  if (dni.length < 6) {
    redirect(
      '/admin/jugadores?error=' +
        encodeURIComponent('El jugador no tiene un DNI válido (mín. 6 caracteres) para usar como clave.'),
    );
  }
  await admin.auth.admin.updateUserById(id, { password: dni });
  redirect('/admin/jugadores?ok=' + encodeURIComponent('Contraseña reiniciada al DNI del jugador.'));
}

// Da de baja / reactiva al jugador.
export async function alternarActivoJugador(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';
  const admin = createAdminClient();
  await admin.from('perfiles').update({ activo: !activo }).eq('id', id);
  refresh();
}
