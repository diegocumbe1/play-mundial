-- =============================================================================
-- Rifas — Premios con fecha de lotería propia (sorteos en fechas distintas)
-- =============================================================================
-- Hasta ahora una rifa de lotería se resolvía con UN resultado: todos los
-- premios jugaban la misma noche. Hay organizadores que reparten los premios
-- en el tiempo (ej. 1° premio el 19/nov, 2° el 10/dic, mayor el 24/dic), cada
-- uno con el resultado de la lotería de ese día.
--
-- Es opcional: si ningún premio tiene `fecha_loteria`, la rifa se comporta
-- como siempre (un solo resultado en `rifas.resultado_loteria`). Si los premios
-- traen fecha, cada uno guarda su propio `resultado_loteria` y la rifa queda
-- `sorteada` solo cuando todos los premios tienen resultado.
-- Idempotente.
-- =============================================================================

alter table public.premios
  add column if not exists fecha_loteria date,
  add column if not exists resultado_loteria text;
