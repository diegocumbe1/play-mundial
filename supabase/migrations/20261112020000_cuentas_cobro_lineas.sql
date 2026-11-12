-- =============================================================================
-- Cuentas de cobro — varios conceptos por documento
-- =============================================================================
-- `lineas` = [{ descripcion, detalle, cantidad, valor_unitario }]. Si está vacía,
-- la cuenta usa el concepto y el valor únicos de siempre (compatibilidad).
-- `valor` sigue guardando el TOTAL y lo calcula el servidor.
-- Idempotente / re-ejecutable.
-- =============================================================================
alter table public.cuentas_cobro
  add column if not exists lineas jsonb not null default '[]'::jsonb;
