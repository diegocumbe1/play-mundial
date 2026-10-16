-- =============================================================================
-- Capa gratuita de rifas: solo la PRIMERA rifa es gratis (antes eran 2).
-- =============================================================================
-- El cupo es de por vida por cuenta (se registra en `tenant_free_usos`, que es
-- append-only), así que con total = 1 el límite mensual deja de importar.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.plataforma_config
  alter column free_rifas_total set default 1;

update public.plataforma_config
set free_rifas_total = 1
where free_rifas_total = 2;
