-- supabase/sql/04_storage_comprobantes.sql
-- Fase 2 — Políticas de Storage para el bucket privado 'comprobantes'.
-- El bucket ya fue creado (privado, máx 5MB, jpg/png/webp/pdf).
-- Córrelo en Supabase: Dashboard -> SQL Editor -> pega y RUN.
--
-- Convención de ruta: comprobantes/{usuario_id}/{archivo}
-- Así la RLS verifica que la primera carpeta sea el propio uid.

-- Subir: solo bajo la carpeta propia.
drop policy if exists "comprobantes_subir_propios" on storage.objects;
create policy "comprobantes_subir_propios"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Ver: el dueño ve los suyos.
drop policy if exists "comprobantes_ver_propios" on storage.objects;
create policy "comprobantes_ver_propios"
on storage.objects for select to authenticated
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Actualizar / borrar: solo el dueño (por si re-sube su comprobante).
drop policy if exists "comprobantes_actualizar_propios" on storage.objects;
create policy "comprobantes_actualizar_propios"
on storage.objects for update to authenticated
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "comprobantes_borrar_propios" on storage.objects;
create policy "comprobantes_borrar_propios"
on storage.objects for delete to authenticated
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- El admin ve TODOS los comprobantes (para aprobarlos en el siguiente paso).
drop policy if exists "comprobantes_admin_ve_todo" on storage.objects;
create policy "comprobantes_admin_ve_todo"
on storage.objects for select to authenticated
using (bucket_id = 'comprobantes' and public.es_admin());
