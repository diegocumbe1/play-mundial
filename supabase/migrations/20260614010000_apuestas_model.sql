-- =============================================================================
-- Rework: "polla por partido" (pozos independientes)
-- =============================================================================
-- Cada apuesta es a UN partido. No se acumula entre partidos. El pozo de un
-- partido = (apuestas pagadas de ese partido) x costo. Ganadores: quienes
-- aciertan el marcador exacto (se calcula en la app); si nadie acierta, el
-- pozo queda en casa.
--
-- Sustituye el modelo anterior (participaciones + pronosticos + ranking).
-- La tabla `partidos` se conserva intacta.
-- =============================================================================

drop view if exists public.tabla_posiciones;
drop table if exists public.pronosticos;
drop table if exists public.participaciones;

create table public.apuestas (
  id               uuid primary key default gen_random_uuid(),
  partido_id       uuid not null references public.partidos (id) on delete cascade,
  nombre           text not null,
  email            text,
  goles_local      integer not null check (goles_local >= 0),
  goles_visitante  integer not null check (goles_visitante >= 0),
  pagado           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
  -- Sin unique: una persona puede hacer VARIAS apuestas al mismo partido
  -- (cada una es un cobro independiente).
);

create index apuestas_partido_idx on public.apuestas (partido_id);

create trigger apuestas_set_updated_at
  before update on public.apuestas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: lectura y alta públicas; edición/borrado solo admin (vía service role
-- o sesión autenticada).
-- ---------------------------------------------------------------------------
alter table public.apuestas enable row level security;

create policy "apuestas_select_public"
  on public.apuestas for select
  to anon, authenticated
  using (true);

create policy "apuestas_insert_public"
  on public.apuestas for insert
  to anon, authenticated
  with check (true);

create policy "apuestas_admin_update"
  on public.apuestas for update
  to authenticated
  using (true)
  with check (true);

create policy "apuestas_admin_delete"
  on public.apuestas for delete
  to authenticated
  using (true);
