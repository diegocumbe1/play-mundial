-- =============================================================================
-- Rifas archivadas
-- =============================================================================
-- El organizador puede archivar una rifa (de prueba, hecha por error o ya
-- terminada): sale de su lista principal y deja de ser pública, pero conserva
-- todo. Desde "Archivadas" la puede restaurar o borrar para siempre.
--
-- Es una marca aparte de `estado` a propósito: al restaurar, la rifa vuelve
-- exactamente como estaba (activa, sorteada, etc.).
--
-- Borrar no devuelve el cupo gratis: `tenant_free_usos` no tiene FK a rifas.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.rifas
  add column if not exists archivada_at timestamptz;

create index if not exists rifas_archivada_idx
  on public.rifas (tenant_id)
  where archivada_at is not null;
