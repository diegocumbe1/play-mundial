-- =============================================================================
-- Cuentas de cobro — correo al que avisar cuando el cliente completa sus datos
-- =============================================================================
-- Vacío = no se manda correo (el aviso al celular sale igual). Idempotente.
alter table public.cuentas_cobro_config
  add column if not exists aviso_correo text;
