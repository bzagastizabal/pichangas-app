-- Fase 6 — Recordatorios por hora con pg_cron + pg_net (gratis, sin Vercel Pro).
-- pg_cron llama cada hora al endpoint /api/recordatorios?horas=3 de tu app.
--
-- ANTES DE CORRER, reemplaza:
--   TU_DOMINIO     -> tu dominio de producción (ej. https://pichangas.com)
--   TU_CRON_SECRET -> el mismo valor de la env var CRON_SECRET en Vercel
--
-- Requisitos: pg_cron ya está activo (job 07). pg_net se habilita aquí.

create extension if not exists pg_net;

-- Reemplaza el job si ya existía (idempotente).
select cron.unschedule(jobid) from cron.job where jobname = 'recordatorios-email';

-- Cada hora, en el minuto 0. Avisa de eventos que se juegan en <= 3 h.
select cron.schedule(
  'recordatorios-email',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'TU_DOMINIO/api/recordatorios?horas=3',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET')
  );
  $$
);

-- Para ver el estado del job:  select * from cron.job where jobname = 'recordatorios-email';
-- Para ver ejecuciones:        select * from cron.job_run_details order by start_time desc limit 10;
