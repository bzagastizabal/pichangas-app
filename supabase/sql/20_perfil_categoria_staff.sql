-- 20 — Recomendaciones del piloto:
--  · perfiles: fecha_nacimiento + nacionalidad (para edad, cumpleaños, categoría)
--  · categorias: edad_min/edad_max opcionales (auto-sugerir por edad)
--  · staff: foto_url (bucket público 'staff_fotos' para cada contacto)

-- 1. Perfiles
alter table public.perfiles
  add column if not exists fecha_nacimiento date,
  add column if not exists nacionalidad text;

-- 2. Categorías con rango de edad opcional
alter table public.categorias
  add column if not exists edad_min int check (edad_min is null or edad_min >= 0),
  add column if not exists edad_max int check (edad_max is null or edad_max >= 0);

-- 3. Staff foto
alter table public.staff
  add column if not exists foto_url text;

-- Bucket PÚBLICO para las fotos del staff (se ven en /ayuda sin sesión).
insert into storage.buckets (id, name, public)
values ('staff_fotos','staff_fotos', true)
on conflict (id) do nothing;

drop policy if exists "staff_fotos_read"          on storage.objects;
drop policy if exists "staff_fotos_admin_write"   on storage.objects;
drop policy if exists "staff_fotos_admin_update"  on storage.objects;
drop policy if exists "staff_fotos_admin_delete"  on storage.objects;

create policy "staff_fotos_read" on storage.objects
  for select to public
  using (bucket_id = 'staff_fotos');

create policy "staff_fotos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'staff_fotos' and public.es_admin());

create policy "staff_fotos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'staff_fotos' and public.es_admin())
  with check (bucket_id = 'staff_fotos' and public.es_admin());

create policy "staff_fotos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'staff_fotos' and public.es_admin());
