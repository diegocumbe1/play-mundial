-- =============================================================================
-- Sincronización automática de partidos con Supabase pg_cron
-- =============================================================================
-- Programa DOS jobs dentro de la BD que llaman a /api/sync (polling adaptativo):
--
--   sync-partidos       -> cada 15 min, SIEMPRE sincroniza (cadencia base).
--   sync-partidos-vivo  -> cada 3 min, con `?modo=live`: el endpoint solo
--                          consulta al proveedor si hay un partido en vivo;
--                          si no, responde al instante sin gastar cuota.
--
-- Así tienes goles con ~3 min de latencia durante los partidos, sin quemar el
-- rate limit del plan gratuito el resto del día. Independiente de Vercel.
--
-- NO se corre con migraciones: ejecútalo MANUALMENTE en el SQL Editor de
-- Supabase, reemplazando los dos placeholders de abajo.
--
-- Reemplaza:
--   <TU_URL>          -> la URL pública de tu app, ej. https://play-mundial.uselynko.com
--   <TU_CRON_SECRET>  -> el MISMO valor de CRON_SECRET que pusiste en Vercel
-- =============================================================================

-- 1. Habilitar extensiones (una sola vez).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2a. Cadencia base: cada 15 min, sincroniza siempre.
--     Si el job ya existe con ese nombre, se actualiza (no se duplica).
select cron.schedule(
  'sync-partidos',
  '*/15 * * * *',
  $$
    select net.http_get(
      url                  := '<TU_URL>/api/sync',
      headers              := jsonb_build_object('Authorization', 'Bearer <TU_CRON_SECRET>'),
      -- pg_net corta a los 5s por defecto y escribe status_code = NULL.
      -- El sync puede reintentar el fetch al proveedor, así que damos 30s.
      timeout_milliseconds := 30000
    );
  $$
);

-- 2b. Cadencia en vivo: cada 3 min, con ?modo=live. El endpoint salta el fetch
--     si no hay partidos activos, así que fuera de horario casi no cuesta nada.
select cron.schedule(
  'sync-partidos-vivo',
  '*/3 * * * *',
  $$
    select net.http_get(
      url                  := '<TU_URL>/api/sync?modo=live',
      headers              := jsonb_build_object('Authorization', 'Bearer <TU_CRON_SECRET>'),
      timeout_milliseconds := 30000
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
-- Ver las respuestas HTTP de pg_net (incluye los "omitido" del modo vivo):
--   select id, status_code, content from net._http_response order by id desc limit 10;
--
-- Cambiar la frecuencia: vuelve a correr el cron.schedule con otro cron expr.
--
-- Apagar la sincronización automática:
--   select cron.unschedule('sync-partidos');
--   select cron.unschedule('sync-partidos-vivo');
-- =============================================================================
