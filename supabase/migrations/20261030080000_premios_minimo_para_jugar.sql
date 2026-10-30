-- =============================================================================
-- Rifas — Requisito de pago POR PREMIO (reemplaza "cuotas al día")
-- =============================================================================
-- La primera versión de 20261030070000 se aplicó con `rifas.cuotas_al_dia`
-- (una regla para toda la rifa). Quedó por premio: cada uno dice cuánto debe
-- llevar pagado el número para jugarlo. Ej.: con $50.000 abonados se juegan los
-- dos premios de $500.000; el kit (el mayor) exige el pago completo.
--
--   premios.minimo_para_jugar → null = pago completo (por defecto).
--
-- `rifas.cuotas_al_dia` ya no se usa: se elimina.
-- Idempotente.
-- =============================================================================

alter table public.premios
  add column if not exists minimo_para_jugar integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'premios_minimo_para_jugar_check') then
    alter table public.premios
      add constraint premios_minimo_para_jugar_check
      check (minimo_para_jugar is null or minimo_para_jugar > 0);
  end if;
end $$;

alter table public.rifas
  drop column if exists cuotas_al_dia;

-- PostgREST cachea el esquema: sin esto la API sigue diciendo que la columna
-- nueva no existe ("schema cache") hasta que se recargue sola.
notify pgrst, 'reload schema';
