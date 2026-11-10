-- =============================================================================
-- Torneos — llave anticipada (estilo Mundial)
-- =============================================================================
-- La llave se puede armar antes de que terminen los grupos: cada lugar de la
-- primera ronda guarda de dónde sale su equipo ("1A" = 1° del grupo A) y se
-- llena solo cuando ese grupo termina. Las rondas siguientes no lo necesitan:
-- su origen se deduce de la fase y el orden ("Ganador cuartos 1").
-- NULL = lugar sin origen (partido normal o pase directo).
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.encuentros
  add column if not exists origen_a text,
  add column if not exists origen_b text;

-- `anon` solo lee columnas públicas (ver 20261109020000): estas lo son.
grant select (origen_a, origen_b) on public.encuentros to anon;
