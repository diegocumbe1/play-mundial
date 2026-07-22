-- =============================================================================
-- Rifas — URL oficial de la lotería (para consultar y compartir resultados)
-- =============================================================================
-- Ej.: https://loteriademanizales.com/ — se muestra en el backoffice (para que
-- el owner verifique el sorteo) y en la página pública (transparencia).
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists loteria_url text;
