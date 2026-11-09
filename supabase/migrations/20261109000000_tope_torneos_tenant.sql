-- =============================================================================
-- Torneos — Tope de torneos por organizador
-- =============================================================================
-- Por defecto un organizador solo puede crear 1 torneo (los demos no cuentan).
-- El superadmin lo desbloquea cuando el organizador paga:
--   - `max_torneos = 1`    → bloqueado en 1 torneo (por defecto).
--   - `max_torneos = NULL` → sin límite.
-- El superadmin puede seguir creando o reasignando torneos a cualquier
-- organizador sin importar el tope.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.tenants
  add column if not exists max_torneos integer default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_max_torneos_check'
  ) then
    alter table public.tenants
      add constraint tenants_max_torneos_check check (max_torneos is null or max_torneos >= 1);
  end if;
end $$;
