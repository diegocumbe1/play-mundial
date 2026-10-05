-- =============================================================================
-- Rifas — Foto por premio
-- =============================================================================
-- Cuando la rifa tiene varios premios (ej. 1° Power Bank, 2° Echo Show), cada
-- uno puede llevar su propia foto. Se pinta en el flyer (tarjeta por premio con
-- "gana con las primeras/últimas cifras") y en el enlace público.
-- La imagen vive en el bucket público `rifa-imagenes`, igual que la portada.
-- Idempotente.
-- =============================================================================

alter table public.premios
  add column if not exists imagen_url text;
