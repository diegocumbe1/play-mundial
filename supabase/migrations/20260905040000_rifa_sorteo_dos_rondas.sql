-- =============================================================================
-- Rifas — Sorteo en dos rondas: finalistas y ronda final
-- =============================================================================
-- Antes se sacaban N balotas y los premios se repartían por posición. Ahora el
-- sorteo puede tener dos tiempos, como en la calle:
--   1) CLASIFICATORIA: se sacan `sorteo_bolas` balotas de entre todas las que
--      juegan. Esas quedan de finalistas.
--   2) FINAL: se revuelven SOLO esas finalistas y salen `sorteo_ganadores`
--      (por defecto 1, que se lleva el premio mayor).
--
-- Si `sorteo_ganadores >= sorteo_bolas` no hay segunda ronda: cada balota que
-- sale ya lleva su premio (el comportamiento anterior).
--
-- `sorteo_finales` guarda la secuencia real de la ronda final, igual que
-- `sorteo_secuencia` guarda la de la clasificatoria.
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists sorteo_ganadores integer not null default 1,
  add column if not exists sorteo_finales jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rifas_sorteo_ganadores_check'
  ) then
    alter table public.rifas
      add constraint rifas_sorteo_ganadores_check
      check (sorteo_ganadores between 1 and 10);
  end if;
end $$;
