-- =============================================================================
-- Rifas — Marca de los números vendidos en el enlace público
-- =============================================================================
-- `marca_ocupado` = cómo se ve un número ya tomado en la grilla pública:
-- chulito (✓), tachado o equis (✕). Se elige al crear/editar la rifa, junto al
-- tema y la decoración. Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists marca_ocupado text not null default 'chulito';

alter table public.rifas drop constraint if exists rifas_marca_ocupado_check;
alter table public.rifas
  add constraint rifas_marca_ocupado_check
  check (marca_ocupado in ('chulito', 'tachado', 'equis'));
