alter table public.partidos
  add column if not exists goles_reglamentario_local integer check (
    goles_reglamentario_local is null or goles_reglamentario_local >= 0
  ),
  add column if not exists goles_reglamentario_visitante integer check (
    goles_reglamentario_visitante is null or goles_reglamentario_visitante >= 0
  ),
  add column if not exists resultado_manual boolean not null default false;
