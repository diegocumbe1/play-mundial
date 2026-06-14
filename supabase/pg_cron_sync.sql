-- =============================================================================
-- Sincronización automática de partidos con Supabase pg_cron
-- =============================================================================
-- Programa un job dentro de la BD que llama a /api/sync cada 15 minutos.
-- Independiente de Vercel (funciona también en plan Hobby).
--
-- NO se corre con migraciones: ejecútalo MANUALMENTE en el SQL Editor de
-- Supabase, reemplazando los dos placeholders de abajo.
--
-- Reemplaza:
--   <TU_URL>          -> la URL pública de tu app desplegada, ej.
--                        https://polla-futbolera.vercel.app
--   <TU_CRON_SECRET>  -> el MISMO valor de CRON_SECRET que pusiste en Vercel
-- =============================================================================

-- 1. Habilitar extensiones (una sola vez).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Programar (o reprogramar) el job cada 15 minutos.
--    Si el job ya existe con ese nombre, se actualiza.
select cron.schedule(
  'sync-partidos',
  '*/15 * * * *',
  $$
    select net.http_get(
      url     := '<TU_URL>/api/sync',
      headers := jsonb_build_object('Authorization', 'Bearer <TU_CRON_SECRET>')
    );
  $$
);

-- =============================================================================
-- Comandos útiles (ejecutar sueltos cuando los necesites):
-- =============================================================================
-- Ver los jobs programados:
--   select jobid, jobname, schedule, command from cron.job;
--
-- Ver las últimas ejecuciones (éxito/fallo):
--   select * from cron.job_run_details order by start_time desc limit 10;
--
-- Ver las respuestas HTTP de pg_net:
--   select id, status_code, content from net._http_response order by id desc limit 10;
--
-- Cambiar la frecuencia (ej. cada 10 min): vuelve a correr el cron.schedule
-- de arriba con '*/10 * * * *'.
--
-- Apagar la sincronización automática:
--   select cron.unschedule('sync-partidos');
-- =============================================================================
