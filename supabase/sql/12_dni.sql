-- Fase 5F — DNI como identificador único del jugador.
alter table public.perfiles add column if not exists dni text;

-- Único entre los que tienen DNI (los auto-registrados sin DNI no chocan).
create unique index if not exists perfiles_dni_unico
  on public.perfiles (dni) where dni is not null;

-- Segundo trigger: copia el dni del metadata al perfil al crear el usuario.
-- (No toca el trigger existente; corre después por orden alfabético.)
create or replace function public.set_perfil_dni()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfiles
    set dni = nullif(new.raw_user_meta_data ->> 'dni', '')
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_dni on auth.users;
create trigger on_auth_user_dni
  after insert on auth.users
  for each row execute function public.set_perfil_dni();
