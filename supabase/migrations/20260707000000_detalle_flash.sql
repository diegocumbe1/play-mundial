-- Detalle del resultado más allá del tiempo reglamentario (prórroga, penales y
-- goleadores), reconstruido desde flashscore. El marcador que LIQUIDA sigue en
-- goles_reglamentario_*; esto es solo informativo para la UI.
--
-- Forma del JSON:
--   {
--     "alargue":    { "local": 2, "visitante": 1 } | null,
--     "penales":    { "local": 4, "visitante": 3 } | null,
--     "goleadores": [ { "minuto":"29","team":"home","jugador":"Messi L.",
--                       "en_contra":false,"penal":false }, ... ],
--     "match_id":   "O4oeJu9d"
--   }
alter table public.partidos
  add column if not exists detalle_flash jsonb;
