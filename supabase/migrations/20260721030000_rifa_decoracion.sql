-- =============================================================================
-- Rifas — Decoración: adornos del enlace público y el flyer
-- =============================================================================
-- `decoracion` = motivo decorativo (floral, botánico, geométrico, confeti…).
-- Se combina con `tema` (paleta) para dar identidad a cada rifa. Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists decoracion text not null default 'floral';
