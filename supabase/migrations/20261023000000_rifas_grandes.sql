-- =============================================================================
-- Rifas grandes: hasta 10.000 números, 4 cifras y mínimo de números por compra
-- =============================================================================
-- 1) Tope del cobro por tamaño. El 1% del recaudo sigue igual, pero el techo
--    sube con la cantidad de números: hasta 1.000 → `cobro_rifa_max` (29.900),
--    hasta 5.000 → `cobro_rifa_max_5000`, hasta 10.000 → `cobro_rifa_max_10000`.
--    Una rifa de 10.000 números mueve diez veces más datos y gestión.
--
-- 2) Lotería a 4 cifras: una rifa de 10.000 números (0000–9999) cruza con las
--    4 cifras del resultado.
--
-- 3) `min_numeros_compra`: con boletas baratas el organizador puede exigir que
--    cada compra lleve al menos N números (p. ej. 10 × $1.500).
--
-- Las rifas ya activadas no se tocan: su cobro quedó congelado al activar.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.plataforma_config
  add column if not exists cobro_rifa_max_5000 integer not null default 79900,
  add column if not exists cobro_rifa_max_10000 integer not null default 149900;

do $$
begin
  alter table public.rifas
    drop constraint if exists rifas_formato_cifras_check;
  alter table public.rifas
    add constraint rifas_formato_cifras_check
    check (formato_cifras in (2, 3, 4));
end $$;

alter table public.rifas
  add column if not exists min_numeros_compra integer not null default 1;

do $$
begin
  alter table public.rifas
    drop constraint if exists rifas_min_numeros_compra_check;
  alter table public.rifas
    add constraint rifas_min_numeros_compra_check
    check (min_numeros_compra between 1 and 100);
end $$;
