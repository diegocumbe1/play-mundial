-- =============================================================================
-- Pagos: cuenta de transferencia genérica + Bre-B separado
-- =============================================================================
-- `cuenta_tipo`   = nequi | daviplata | davivienda | nu | bancolombia | otro texto
-- `cuenta_numero` = número/cuenta/alias dentro de esa entidad.
-- `llave` conserva Bre-B aparte.
-- Idempotente.
-- =============================================================================

alter table public.tenant_pago_config
  add column if not exists cuenta_tipo text,
  add column if not exists cuenta_numero text;

update public.tenant_pago_config
set cuenta_tipo = coalesce(cuenta_tipo, 'nequi'),
    cuenta_numero = coalesce(cuenta_numero, nequi_llave)
where nequi_llave is not null
  and cuenta_numero is null;

alter table public.plataforma_pago_config
  add column if not exists cuenta_tipo text,
  add column if not exists cuenta_numero text;

update public.plataforma_pago_config
set cuenta_tipo = coalesce(cuenta_tipo, 'nequi'),
    cuenta_numero = coalesce(cuenta_numero, nequi_llave)
where nequi_llave is not null
  and cuenta_numero is null;
