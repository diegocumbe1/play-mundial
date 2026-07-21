-- =============================================================================
-- Rifas — Personalización: tema visual por rifa
-- =============================================================================
-- `tema` = preset de colores aplicado a la página pública /r/[slug] y al flyer.
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists tema text not null default 'rosa';
