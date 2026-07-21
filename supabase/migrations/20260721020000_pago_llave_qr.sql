-- =============================================================================
-- Rifas — Datos de cobro: llave separada de Nequi + bucket para QR
-- =============================================================================
-- `nequi_llave` = número/cuenta Nequi.  `llave` = llave Bre-B / alias (otra).
-- Al menos uno debe existir (se valida en la app). Bucket público para el QR.
-- Idempotente.
-- =============================================================================

alter table public.tenant_pago_config
  add column if not exists llave text;

-- Bucket público para las imágenes de QR de pago (la subida va por service role).
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('qr-pagos', 'qr-pagos', true)
  on conflict (id) do nothing;
exception when others then
  raise notice 'No se pudo crear el bucket qr-pagos (créalo en el dashboard): %', sqlerrm;
end $$;
