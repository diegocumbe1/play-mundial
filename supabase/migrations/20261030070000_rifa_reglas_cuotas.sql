-- =============================================================================
-- Rifas — Reglas de pago por cuotas (opcionales, las define el organizador)
-- =============================================================================
-- Caso real: puesto de $150.000 en 3 cuotas de $50.000 ("separa con $50.000"),
-- tres sorteos (19/nov, 10/dic y el mayor el 24/dic). Para jugar los premios
-- anticipados el número tiene que estar PAGADO COMPLETO antes de esa fecha; la
-- última cuota vence el 23/dic, un día antes del premio mayor.
--
-- En la rifa:
--   permite_abonos   → se puede separar un número con un abono y pagar el resto.
--   abono_minimo     → valor de la cuota (mínimo para separar y para cada abono).
--   dias_limite_pago → un pago cuenta para un sorteo solo si se registró hasta N
--                      días antes de su fecha (0 = el mismo día). null = sin límite.
--
-- En cada premio:
--   minimo_para_jugar → cuánto debe llevar pagado el número para jugar ESE
--                       premio. null = pago completo (lo normal y por defecto).
--                       Sirve para premios que se juegan "con la cuota al día".
--
-- Todo es opcional: con los valores por defecto la rifa funciona como antes.
-- Idempotente.
-- =============================================================================

alter table public.rifas
  add column if not exists permite_abonos boolean not null default false,
  add column if not exists abono_minimo integer,
  add column if not exists dias_limite_pago integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rifas_reglas_cuotas_check') then
    alter table public.rifas
      add constraint rifas_reglas_cuotas_check
      check (
        (abono_minimo is null or abono_minimo > 0)
        and (dias_limite_pago is null or dias_limite_pago between 0 and 30)
      );
  end if;
end $$;

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
