-- =============================================================================
-- Avisos de torneos con Supabase pg_cron
-- =============================================================================
-- Cada minuto llama a /api/torneos/avisos, que envía los recordatorios de partido
-- y detecta cuándo un juez terminó, para pedir que se apruebe el resultado.
-- Si no hay partidos cerca ni en vivo, responde al instante.
--
-- NO se corre con migraciones: ejecútalo MANUALMENTE en el SQL Editor de
-- Supabase, reemplazando los dos placeholders de abajo.
--
-- Reemplaza:
--   <TU_URL>          -> la URL pública de la app, ej. https://play-mundial.uselynko.com
--   <TU_CRON_SECRET>  -> el MISMO valor de CRON_SECRET que está en Vercel
--
-- Para apagarlo: select cron.unschedule('avisos-torneo');
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'avisos-torneo',
  '* * * * *',
  $$
    select net.http_get(
      url                  := '<TU_URL>/api/torneos/avisos',
      headers              := jsonb_build_object('Authorization', 'Bearer <TU_CRON_SECRET>'),
      timeout_milliseconds := 25000
    );
  $$
);
