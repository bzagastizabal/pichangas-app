-- SQL 41 — ARREGLO URGENTE: el trigger del link de operador rompia TODO
-- insert en `marcadores` (no se podian crear marcadores ni cronometros).
--
-- Sintoma exacto en el form de alta:
--   42883: function gen_random_bytes(integer) does not exist
--
-- Causa: `marcador_clave_nueva()` (SQL 39) genera la clave con
-- gen_random_bytes, que pertenece a pgcrypto y Supabase instala en el esquema
-- `extensions`. En el editor SQL la migracion corrio bien porque ahi el
-- search_path incluye `extensions`. En runtime la llama el trigger
-- `marcador_crea_clave()`, que declara `set search_path = public`; ese ajuste
-- aplica tambien a la funcion SQL anidada, gen_random_bytes deja de resolverse
-- y, como el trigger es AFTER INSERT, la excepcion aborta el insert completo.
--
-- Arreglo: generar la clave solo con funciones del core (md5 y
-- gen_random_uuid viven en pg_catalog, siempre visible), sin depender de
-- ninguna extension ni del search_path. Siguen siendo 18 chars hex.

create or replace function public.marcador_clave_nueva() returns text
language sql volatile set search_path = public as $$
  select substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 18)
$$;

-- Por si algun marcador quedo sin clave mientras el trigger estaba roto.
insert into public.marcador_claves (marcador_id, clave)
select id, public.marcador_clave_nueva() from public.marcadores
on conflict (marcador_id) do nothing;

-- Verificacion rapida (debe devolver 18 chars hex, no error):
--   select public.marcador_clave_nueva();
