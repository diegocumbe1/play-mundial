-- =============================================================================
-- Torneos — restricciones de horario por equipo
-- =============================================================================
-- El organizador anota cuándo puede jugar cada equipo: días de la semana,
-- hora mínima / máxima de inicio y fechas puntuales en que no puede.
-- Forma (ver src/lib/torneo-restricciones.ts):
--   { "dias": [1,2,4], "desde": "19:00", "hasta": "21:00",
--     "fechas_no": ["2026-11-20"], "nota": "" }
-- `null` = sin restricciones. `equipos_torneo` no tiene acceso `anon`, así que
-- este dato no sale en la página pública.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.equipos_torneo
  add column if not exists restricciones_horario jsonb;
