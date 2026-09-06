-- SQL 36 — Avisos configurables del modo cronometro.
-- Antes los hitos de voz estaban hardcodeados en el visor (3/2/1 min, 30s y
-- cuenta 10..1). Ahora viven en la fila del marcador para que el admin los
-- ajuste sin tocar codigo y para que TODOS los visores del mismo slug avisen
-- igual (la config viaja por Realtime como el resto del estado).
--
--   avisos_seg        segundos restantes en los que se anuncia por voz.
--   avisos_repetir    cuantas veces se repite cada aviso (1-3). Default 2.
--   beep_desde_seg    a partir de cuantos segundos suena un beep por segundo
--                     hasta 0 (0 = desactivado). Default 15.
--   voz_cuenta_desde  cuenta regresiva HABLADA de los ultimos N segundos
--                     ("diez, nueve, ocho...", 0 = desactivada). Es el
--                     comportamiento viejo, ahora opt-in.

alter table public.marcadores
  add column if not exists avisos_seg int[] not null default '{180,120,60,30,10}',
  add column if not exists avisos_repetir smallint not null default 2,
  add column if not exists beep_desde_seg smallint not null default 15,
  add column if not exists voz_cuenta_desde smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marcadores_avisos_repetir_chk'
  ) then
    alter table public.marcadores
      add constraint marcadores_avisos_repetir_chk check (avisos_repetir between 1 and 3);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'marcadores_beep_desde_chk'
  ) then
    alter table public.marcadores
      add constraint marcadores_beep_desde_chk check (beep_desde_seg between 0 and 60);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'marcadores_voz_cuenta_chk'
  ) then
    alter table public.marcadores
      add constraint marcadores_voz_cuenta_chk check (voz_cuenta_desde between 0 and 20);
  end if;
end $$;
