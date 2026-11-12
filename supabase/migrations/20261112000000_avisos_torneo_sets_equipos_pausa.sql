-- =============================================================================
-- Avisos de torneo — fin de cada set, equipos que se siguen y pausa
-- =============================================================================
-- - `fin_set`: avisa cada vez que termina un set de un partido en vivo.
-- - `equipos_seguidos`: ids de equipos a seguir; vacío = todos (por defecto).
--   Aplica a recordatorio, en vivo, set, por aprobar, finalizado y siguiente.
-- - `pausado_hasta`: no se envía nada hasta esa fecha; null = sin pausa.
-- - Tipos de aviso nuevos `set_1`…`set_5`, uno por set, para no repetirlos.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.suscripciones_avisos_torneo
  add column if not exists fin_set          boolean     not null default true,
  add column if not exists equipos_seguidos uuid[]      not null default '{}',
  add column if not exists pausado_hasta    timestamptz;

alter table public.avisos_torneo_enviados
  drop constraint if exists avisos_torneo_enviados_tipo_check;

alter table public.avisos_torneo_enviados
  add constraint avisos_torneo_enviados_tipo_check
  check (tipo in (
    'recordatorio', 'en_vivo', 'por_aprobar', 'finalizado', 'siguiente',
    'set_1', 'set_2', 'set_3', 'set_4', 'set_5'
  ));
