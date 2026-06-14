-- =============================================================================
-- Rework: "polla por partido" (idempotente / re-ejecutable)
-- =============================================================================
-- Cada apuesta es a UN partido. No se acumula. Reemplaza el modelo anterior
-- (participaciones + pronosticos + ranking). La tabla `partidos` se conserva.
-- =============================================================================

drop view if exists public.tabla_posiciones;
drop table if exists public.pronosticos;
drop table if exists public.participaciones;

create table if not exists public.apuestas (
  id               uuid primary key default gen_random_uuid(),
  partido_id       uuid not null references public.partidos (id) on delete cascade,
  nombre           text not null,
  email            text,
  goles_local      integer not null check (goles_local >= 0),
  goles_visitante  integer not null check (goles_visitante >= 0),
  pagado           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
  -- Sin unique: una persona puede hacer VARIAS apuestas al mismo partido.
);

create index if not exists apuestas_partido_idx on public.apuestas (partido_id);

drop trigger if exists apuestas_set_updated_at on public.apuestas;
create trigger apuestas_set_updated_at
  before update on public.apuestas
  for each row execute function public.set_updated_at();

alter table public.apuestas enable row level security;

drop policy if exists "apuestas_select_public" on public.apuestas;
create policy "apuestas_select_public" on public.apuestas for select
  to anon, authenticated using (true);
drop policy if exists "apuestas_insert_public" on public.apuestas;
create policy "apuestas_insert_public" on public.apuestas for insert
  to anon, authenticated with check (true);
drop policy if exists "apuestas_admin_update" on public.apuestas;
create policy "apuestas_admin_update" on public.apuestas for update
  to authenticated using (true) with check (true);
drop policy if exists "apuestas_admin_delete" on public.apuestas;
create policy "apuestas_admin_delete" on public.apuestas for delete
  to authenticated using (true);
