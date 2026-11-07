-- =============================================================================
-- Torneos — Suscripción mensual aparte de la de rifas
-- =============================================================================
-- Cada producto tiene su propio precio y su propio vencimiento: PRO cubre rifas
-- y esta suscripción cubre torneos. Un escalón en 0 significa "sin precio".
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.plataforma_config
  add column if not exists precio_suscripcion_torneos_mes integer not null default 0;

alter table public.tenants
  add column if not exists suscripcion_torneos_vence_at timestamptz;
