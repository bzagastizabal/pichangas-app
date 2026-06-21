-- 28 — Bocina manual del marcador.
-- El admin dispara la bocina desde el control y el visor la suena. Usamos un
-- contador monotónico (bocina_pulsos): el visor lo escucha por Realtime y
-- cuando incrementa, reproduce el sonido. Así no hace falta limpiar señales
-- después.

alter table public.marcadores
  add column if not exists bocina_pulsos int not null default 0;

-- RPC que incrementa el contador atómicamente. SECURITY DEFINER + check
-- es_admin() porque la mutación pasa por la sesión del admin (no
-- service-role).
create or replace function public.marcador_bocina(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede sonar la bocina.';
  end if;
  update public.marcadores set bocina_pulsos = bocina_pulsos + 1 where id = p_id;
end;
$$;

grant execute on function public.marcador_bocina(uuid) to authenticated;
