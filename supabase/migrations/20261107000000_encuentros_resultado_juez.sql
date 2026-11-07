-- =============================================================================
-- Torneos — constancia del resultado que reportó el juez
-- =============================================================================
-- El marcador en vivo es temporal: su sala se borra al quedar el resultado
-- oficial. Esta columna conserva lo que reportó el juez, aunque el organizador
-- lo corrija después: { sets, set_sin_terminar, leido_at }.
-- La página pública no la consulta.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.encuentros
  add column if not exists resultado_juez jsonb;
