-- =============================================================================
-- Torneos — Jugadores sin documento y notas "por revisar"
-- =============================================================================
-- El organizador transcribe planillas en papel: a veces falta el documento o un
-- dato no se lee bien. Se guarda igual y queda marcado para revisarlo después.
--
-- - `jugadores_torneo.documento` pasa a ser opcional (solo desde el panel del
--   organizador; la inscripción pública lo sigue exigiendo). La restricción
--   unique (equipo_id, documento) no choca con los NULL.
-- - `nota_revision` (jugador y equipo): qué hay que verificar. NULL = revisado.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.jugadores_torneo
  alter column documento drop not null;

alter table public.jugadores_torneo
  add column if not exists nota_revision text;

alter table public.equipos_torneo
  add column if not exists nota_revision text;
