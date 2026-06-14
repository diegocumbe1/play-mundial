-- =============================================================================
-- Polla Futbolera — Esquema inicial (idempotente / re-ejecutable)
-- =============================================================================
-- Modelo inicial (luego reemplazado por `apuestas` en una migración posterior):
--   partidos, participaciones, pronosticos, vista tabla_posiciones.
-- Auth: admin con login. Lectura pública; escritura de partidos solo admin.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_partido') then
    create type public.estado_partido as enum (
      'programado', 'en_juego', 'finalizado', 'cancelado'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'fuente_partido') then
    create type public.fuente_partido as enum ('manual', 'api');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Función util: mantener updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabla: partidos
-- ---------------------------------------------------------------------------
create table if not exists public.partidos (
  id                     uuid primary key default gen_random_uuid(),
  external_id            text unique,
  fuente                 public.fuente_partido not null default 'manual',
  liga                   text,
  temporada              text,
  equipo_local           text not null,
  equipo_visitante       text not null,
  equipo_local_logo      text,
  equipo_visitante_logo  text,
  fecha                  timestamptz not null,
  goles_local            integer check (goles_local is null or goles_local >= 0),
  goles_visitante        integer check (goles_visitante is null or goles_visitante >= 0),
  estado                 public.estado_partido not null default 'programado',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists partidos_fecha_idx on public.partidos (fecha);
create index if not exists partidos_estado_idx on public.partidos (estado);

drop trigger if exists partidos_set_updated_at on public.partidos;
create trigger partidos_set_updated_at
  before update on public.partidos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabla: participaciones (modelo viejo; se elimina en migración posterior)
-- ---------------------------------------------------------------------------
create table if not exists public.participaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists participaciones_set_updated_at on public.participaciones;
create trigger participaciones_set_updated_at
  before update on public.participaciones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabla: pronosticos (modelo viejo; se elimina en migración posterior)
-- ---------------------------------------------------------------------------
create table if not exists public.pronosticos (
  id                uuid primary key default gen_random_uuid(),
  participacion_id  uuid not null references public.participaciones (id) on delete cascade,
  partido_id        uuid not null references public.partidos (id) on delete cascade,
  goles_local       integer not null check (goles_local >= 0),
  goles_visitante   integer not null check (goles_visitante >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (participacion_id, partido_id)
);

create index if not exists pronosticos_partido_idx on public.pronosticos (partido_id);

drop trigger if exists pronosticos_set_updated_at on public.pronosticos;
create trigger pronosticos_set_updated_at
  before update on public.pronosticos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vista: tabla_posiciones (modelo viejo)
-- ---------------------------------------------------------------------------
create or replace view public.tabla_posiciones
with (security_invoker = on)
as
select
  pa.id   as participacion_id,
  pa.nombre,
  coalesce(count(*) filter (
    where p.estado = 'finalizado'
      and pr.goles_local = p.goles_local
      and pr.goles_visitante = p.goles_visitante
  ), 0)::int as puntaje,
  coalesce(count(*) filter (where p.estado = 'finalizado'), 0)::int as partidos_jugados
from public.participaciones pa
left join public.pronosticos pr on pr.participacion_id = pa.id
left join public.partidos p on p.id = pr.partido_id
group by pa.id, pa.nombre;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.partidos        enable row level security;
alter table public.participaciones enable row level security;
alter table public.pronosticos     enable row level security;

drop policy if exists "partidos_select_public" on public.partidos;
create policy "partidos_select_public" on public.partidos for select
  to anon, authenticated using (true);
drop policy if exists "partidos_admin_insert" on public.partidos;
create policy "partidos_admin_insert" on public.partidos for insert
  to authenticated with check (true);
drop policy if exists "partidos_admin_update" on public.partidos;
create policy "partidos_admin_update" on public.partidos for update
  to authenticated using (true) with check (true);
drop policy if exists "partidos_admin_delete" on public.partidos;
create policy "partidos_admin_delete" on public.partidos for delete
  to authenticated using (true);

drop policy if exists "participaciones_select_public" on public.participaciones;
create policy "participaciones_select_public" on public.participaciones for select
  to anon, authenticated using (true);
drop policy if exists "participaciones_insert_public" on public.participaciones;
create policy "participaciones_insert_public" on public.participaciones for insert
  to anon, authenticated with check (true);
drop policy if exists "participaciones_admin_update" on public.participaciones;
create policy "participaciones_admin_update" on public.participaciones for update
  to authenticated using (true) with check (true);
drop policy if exists "participaciones_admin_delete" on public.participaciones;
create policy "participaciones_admin_delete" on public.participaciones for delete
  to authenticated using (true);

drop policy if exists "pronosticos_select_public" on public.pronosticos;
create policy "pronosticos_select_public" on public.pronosticos for select
  to anon, authenticated using (true);
drop policy if exists "pronosticos_insert_public" on public.pronosticos;
create policy "pronosticos_insert_public" on public.pronosticos for insert
  to anon, authenticated with check (true);
drop policy if exists "pronosticos_admin_update" on public.pronosticos;
create policy "pronosticos_admin_update" on public.pronosticos for update
  to authenticated using (true) with check (true);
drop policy if exists "pronosticos_admin_delete" on public.pronosticos;
create policy "pronosticos_admin_delete" on public.pronosticos for delete
  to authenticated using (true);

-- ===========================================================================
-- Realtime: emitir cambios de `partidos`
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'partidos'
  ) then
    alter publication supabase_realtime add table public.partidos;
  end if;
end $$;
