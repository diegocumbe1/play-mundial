-- =============================================================================
-- Rifas — Mostrar (o no) la simulación del sorteo en el enlace público
-- =============================================================================
-- La simulación explica la mecánica, pero en algunas rifas confunde al
-- comprador (cree que ese sorteo es el de verdad). El organizador decide si
-- aparece en /r/[slug]; en el backoffice siempre está disponible.
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists mostrar_simulacion boolean not null default true;
