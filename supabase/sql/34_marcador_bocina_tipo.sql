-- SQL 34 — tipo de bocina seleccionable.
-- ncaa (default): arena universitaria, grave con vibrato leve.
-- nba: arena pro, mas grave y con wobble mas notorio.
-- high_school: aguda y seca (gym de colegio).
-- air_horn: festival/vuvuzela, aguda con harmonicos brillantes.

alter table public.marcadores
  add column if not exists bocina_tipo text not null default 'ncaa';

alter table public.marcadores drop constraint if exists marcadores_bocina_tipo_chk;
alter table public.marcadores
  add constraint marcadores_bocina_tipo_chk
    check (bocina_tipo in ('ncaa','nba','high_school','air_horn'));
