-- =============================================================================
-- Polla Futbolera — Esquema inicial
-- =============================================================================
-- Modelo:
--   partidos        -> los encuentros (sincronizables desde una API externa)
--   participaciones -> cada persona que juega la polla
--   pronosticos     -> el marcador que cada participación predice por partido
--
-- Auth: admin con login (Supabase Auth). Lectura pública; la escritura de
-- partidos/resultados es solo para usuarios autenticados (admin).
--
-- Puntaje: 1 punto por marcador EXACTO. No se almacena: se calcula en la
-- vista `tabla_posiciones`.
-- =============================================================================

-- Extensión para uuid_generate / gen_random_uuid ya viene disponible en Supabase.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.estado_partido as enum (
  'programado',
  'en_juego',
  'finalizado',
  'cancelado'
);

-- Origen del registro del partido.
create type public.fuente_partido as enum ('manual', 'api');

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
create table public.partidos (
  id                     uuid primary key default gen_random_uuid(),
  -- Identificador del partido en el proveedor externo (API de fútbol).
  -- NULL cuando el partido se crea manualmente. Único para permitir upsert.
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

create index partidos_fecha_idx on public.partidos (fecha);
create index partidos_estado_idx on public.partidos (estado);

create trigger partidos_set_updated_at
  before update on public.partidos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabla: participaciones
-- ---------------------------------------------------------------------------
create table public.participaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger participaciones_set_updated_at
  before update on public.participaciones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tabla: pronosticos
-- ---------------------------------------------------------------------------
create table public.pronosticos (
  id                uuid primary key default gen_random_uuid(),
  participacion_id  uuid not null references public.participaciones (id) on delete cascade,
  partido_id        uuid not null references public.partidos (id) on delete cascade,
  goles_local       integer not null check (goles_local >= 0),
  goles_visitante   integer not null check (goles_visitante >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Un único pronóstico por (participación, partido).
  unique (participacion_id, partido_id)
);

create index pronosticos_partido_idx on public.pronosticos (partido_id);

create trigger pronosticos_set_updated_at
  before update on public.pronosticos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vista: tabla_posiciones (leaderboard)
-- 1 punto por marcador exacto en partidos finalizados.
-- ---------------------------------------------------------------------------
create view public.tabla_posiciones
with (security_invoker = on)
as
select
  pa.id   as participacion_id,
  pa.nombre,
  coalesce(
    count(*) filter (
      where p.estado = 'finalizado'
        and pr.goles_local = p.goles_local
        and pr.goles_visitante = p.goles_visitante
    ),
    0
  )::int as puntaje,
  coalesce(
    count(*) filter (where p.estado = 'finalizado'),
    0
  )::int as partidos_jugados
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

-- --- partidos: lectura pública, escritura solo admin (autenticado) ----------
create policy "partidos_select_public"
  on public.partidos for select
  to anon, authenticated
  using (true);

create policy "partidos_admin_insert"
  on public.partidos for insert
  to authenticated
  with check (true);

create policy "partidos_admin_update"
  on public.partidos for update
  to authenticated
  using (true)
  with check (true);

create policy "partidos_admin_delete"
  on public.partidos for delete
  to authenticated
  using (true);

-- --- participaciones: lectura pública, registro público, edición admin ------
create policy "participaciones_select_public"
  on public.participaciones for select
  to anon, authenticated
  using (true);

create policy "participaciones_insert_public"
  on public.participaciones for insert
  to anon, authenticated
  with check (true);

create policy "participaciones_admin_update"
  on public.participaciones for update
  to authenticated
  using (true)
  with check (true);

create policy "participaciones_admin_delete"
  on public.participaciones for delete
  to authenticated
  using (true);

-- --- pronosticos: lectura pública, alta pública, edición admin --------------
create policy "pronosticos_select_public"
  on public.pronosticos for select
  to anon, authenticated
  using (true);

create policy "pronosticos_insert_public"
  on public.pronosticos for insert
  to anon, authenticated
  with check (true);

create policy "pronosticos_admin_update"
  on public.pronosticos for update
  to authenticated
  using (true)
  with check (true);

create policy "pronosticos_admin_delete"
  on public.pronosticos for delete
  to authenticated
  using (true);

-- ===========================================================================
-- Realtime: emitir cambios de `partidos` (resultados en vivo al frontend)
-- ===========================================================================
alter publication supabase_realtime add table public.partidos;
