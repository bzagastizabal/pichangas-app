// Layout del panel: protege /admin (solo administradores) y monta el shell
// (sidebar + barra superior). El guard es server-side; el shell es de UI.
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from './AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireAdmin();
  return <AdminShell nombre={perfil.nombre_completo ?? ''}>{children}</AdminShell>;
}
