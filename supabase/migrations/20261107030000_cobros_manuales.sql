-- =============================================================================
-- Cobros — registro manual desde el superadmin
-- =============================================================================
-- El superadmin negocia precios por fuera (p. ej. torneos a un parque) y
-- necesita dejar constancia del cobro con su monto, aunque no coincida con el
-- precio de lista y aunque el organizador no lo haya solicitado desde /precios.
--
-- - `meses`: cuántos meses de suscripción cubre el cobro al confirmarse
--   (antes siempre era 1).
-- - `nota`: detalle del acuerdo ("torneo relámpago diciembre", etc.).
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.cobros
  add column if not exists meses integer not null default 1,
  add column if not exists nota  text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobros_meses_check'
  ) then
    alter table public.cobros
      add constraint cobros_meses_check check (meses between 1 and 24);
  end if;
end $$;
