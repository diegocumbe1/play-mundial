-- =============================================================================
-- Torneos — el organizador puede ocultar TODOS los patrocinadores
-- =============================================================================
-- `mostrar_patrocinadores = false` oculta la cinta y la franja de la página pública
-- y la valla de la TV, aunque haya patrocinadores publicados. No borra nada.
-- Por defecto se muestran (como hasta ahora). Idempotente.
alter table public.torneos
  add column if not exists mostrar_patrocinadores boolean not null default true;
