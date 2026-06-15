-- Indica si un partido en juego está pausado (medio tiempo / descanso).
-- El partido sigue siendo estado='en_juego' (EN VIVO); esta bandera solo
-- cambia la etiqueta a "Medio tiempo" mientras dure la pausa.
alter table public.partidos
  add column if not exists en_pausa boolean not null default false;
