-- =============================================================================
-- Nuevos precios de rifas: básica / comercial y plan gratis con precio máximo
-- =============================================================================
-- La tarifa de activación se calcula sobre el VALOR TOTAL POTENCIAL de la rifa
-- (números × precio), se vendan o no todos los números.
--
-- 1) Rifa básica (potencial ≤ $3.000.000): 1%, mínimo $9.900 (antes $8.000),
--    tope $29.900 hasta 1.000 números.
-- 2) Rifa comercial (potencial > `cobro_rifa_umbral_comercial`): tarifa fija
--    `cobro_rifa_comercial` ($49.900), pago único, sin comisión por venta. En
--    rifas de más de 1.000 números rigen los topes de 5.000 / 10.000 si el 1%
--    queda por encima.
-- 3) Plan gratis: además del tope de 100 números, el precio por número no
--    puede pasar de `free_max_precio_numero` ($20.000).
--
-- Las rifas ya activadas no se tocan: su cobro quedó congelado al activar.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.plataforma_config
  add column if not exists cobro_rifa_umbral_comercial integer not null default 3000000,
  add column if not exists cobro_rifa_comercial integer not null default 49900,
  add column if not exists free_max_precio_numero integer not null default 20000;

-- Piso nuevo: solo si sigue en el valor anterior (no pisa un ajuste manual).
update public.plataforma_config
   set cobro_rifa_min = 9900
 where cobro_rifa_min = 8000;
