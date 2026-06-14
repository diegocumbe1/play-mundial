-- Marca si el premio del partido ya se le pagó al/los ganador(es).
-- (Distinto de apuestas.pagado, que es si el participante pagó su apuesta.)
alter table public.partidos
  add column if not exists premio_pagado boolean not null default false;
