-- =============================================================================
-- Plataforma — Cobro por rifa = el valor de UNA boleta
-- =============================================================================
-- Regla nueva: activar una rifa cuesta lo mismo que uno de sus puestos. Es lo
-- más fácil de explicar ("te cuesta una boleta") y escala solo con la rifa: una
-- de $15.000 el puesto cuesta $15.000, una de $2.000 cuesta $2.000.
--
-- Ojo con el porcentaje: cobrar una boleta equivale a 100/N del recaudo, o sea
-- que solo da 1% en rifas de 100 números (en una de 30 es 3,3%; en una de 1000,
-- 0,1%). Por eso existen el mínimo y el tope: sin ellos, una rifa de 1000
-- números a $1.000 dejaría $1.000 de ingreso, y una de boleta muy cara cobraría
-- de más. En 0 quedan desactivados.
--
-- `cobro_rifa_modo = 'escalones'` vuelve al esquema anterior por tamaño.
-- La capa gratuita no cambia: sigue mandando antes que cualquier cobro.
-- Idempotente.
-- =============================================================================

alter table public.plataforma_config
  add column if not exists cobro_rifa_modo text not null default 'boleta',
  add column if not exists cobro_rifa_min integer not null default 0,
  add column if not exists cobro_rifa_max integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plataforma_config_cobro_rifa_modo_check'
  ) then
    alter table public.plataforma_config
      add constraint plataforma_config_cobro_rifa_modo_check
      check (cobro_rifa_modo in ('boleta', 'escalones'));
  end if;
end $$;
