-- =============================================================================
-- Torneos — ¿ya se pagó el arbitraje de este partido?
-- =============================================================================
-- Casilla opcional que el organizador marca antes de iniciar cada partido. Es
-- un dato interno: no sale en la página pública ni lo ve el juez (que solo usa
-- el enlace del marcador).
--
-- `encuentros` es legible por `anon` (fixture público), y RLS filtra filas, no
-- columnas. Por eso a `anon` se le da SELECT solo sobre las columnas públicas:
-- la nueva columna queda fuera. La app lee con service role, así que no cambia.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.encuentros
  add column if not exists arbitraje_pagado boolean not null default false;

revoke select on public.encuentros from anon;
grant select (
  id, tenant_id, torneo_id, categoria_id, fase, grupo, ronda, orden,
  equipo_a_id, equipo_b_id, cancha, programado_at, estado, sets, ganador_id,
  sala_marcador, resultado_juez, created_at, updated_at
) on public.encuentros to anon;
