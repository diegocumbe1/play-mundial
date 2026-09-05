-- =============================================================================
-- Rifas — Sorteo en vivo: cuántas balotas se han revelado
-- =============================================================================
-- El resultado se decide entero al pulsar "Sortear" (queda firmado en
-- `sorteo_secuencia`), pero se muestra a ritmo del organizador. `sorteo_reveladas`
-- es el contador de balotas ya cantadas: la página pública solo puede ver ESAS
-- —nunca las que faltan— y por eso el live no filtra el resultado.
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists sorteo_reveladas integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rifas_sorteo_reveladas_check'
  ) then
    alter table public.rifas
      add constraint rifas_sorteo_reveladas_check check (sorteo_reveladas >= 0);
  end if;
end $$;
