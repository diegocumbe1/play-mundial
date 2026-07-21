-- =============================================================================
-- Rifas — fecha_sorteo pasa de timestamptz a date (fecha de calendario)
-- =============================================================================
-- Evita el corrimiento de un día por zona horaria: la fecha del sorteo es un
-- día, no un instante. Idempotente (re-ejecutar sobre date es no-op).
-- =============================================================================

alter table public.rifas
  alter column fecha_sorteo type date using (fecha_sorteo::date);
