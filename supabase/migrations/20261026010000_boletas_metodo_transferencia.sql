-- =============================================================================
-- Boletas pagadas antes de poder elegir medio → transferencia
-- =============================================================================
-- Hasta el 2026-10-26 el backoffice guardaba TODO pago de boleta como
-- 'efectivo' (no había selector). Ese dato no es real: el medio por defecto es
-- transferencia. Se corrigen solo los pagos anteriores a esa fecha, así los
-- elegidos a propósito después nunca se pisan (re-ejecutable sin daño).
--
-- El trigger de correo verificado se apaga solo durante este arreglo de datos:
-- no es un movimiento de números, y sin él un tenant sin verificar tumbaría la
-- migración entera.
-- =============================================================================

alter table public.boletas disable trigger boletas_email_verificado;

update public.boletas
set metodo_pago = 'transferencia'
where estado = 'pagado'
  and (metodo_pago is null or metodo_pago = 'efectivo')
  and pagado_at < '2026-10-26 00:00:00-05';

alter table public.boletas enable trigger boletas_email_verificado;
