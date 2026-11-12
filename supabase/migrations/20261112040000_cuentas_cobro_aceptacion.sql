-- =============================================================================
-- Cuentas de cobro — aceptación del cliente
-- =============================================================================
-- Al completar sus datos el cliente marca «Acepto esta cuenta de cobro». Se
-- guarda cuándo y POR CUÁNTO aceptó: si el valor cambia después, se nota.
-- Al reabrir los datos al cliente, la aceptación se borra y debe aceptar de nuevo.
-- Idempotente / re-ejecutable.
-- =============================================================================
alter table public.cuentas_cobro
  add column if not exists aceptada_at    timestamptz,
  add column if not exists aceptada_valor integer;
