-- =============================================================================
-- Torneos — partidos (fixture y resultados) + bandera de demo
-- =============================================================================
-- `encuentros` guarda cada partido del torneo: fase de grupos y eliminatorias,
-- con el marcador por sets (voleibol) en `sets` = [[21,18],[19,21],[15,12]].
-- La tabla de posiciones NO se guarda: se calcula en `src/lib/torneo-fixture.ts`
-- a partir de los partidos, así nunca queda desalineada.
--
-- `sala_marcador` es el código de sala del marcador en vivo (dc-sport-score).
-- `torneos.es_demo` habilita el simulador de etapas (solo torneos de muestra).
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.torneos
  add column if not exists es_demo boolean not null default false;

-- Demos creadas antes de esta migración.
update public.torneos
set es_demo = true
where nombre like 'DEMO · %' and plantilla = 'voleiplaya' and not es_demo;

create table if not exists public.encuentros (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  torneo_id      uuid not null references public.torneos (id) on delete cascade,
  categoria_id   uuid references public.categorias_torneo (id) on delete cascade,
  fase           text not null check (fase in
                   ('grupos','octavos','cuartos','semifinal','tercer_puesto','final')),
  grupo          text,                       -- "A", "B"… solo en fase de grupos
  ronda          integer not null default 1, -- jornada dentro de la fase
  orden          integer not null default 0, -- posición en la llave / en la jornada
  -- NULL mientras el cruce no esté definido ("Ganador semifinal 1").
  equipo_a_id    uuid references public.equipos_torneo (id) on delete set null,
  equipo_b_id    uuid references public.equipos_torneo (id) on delete set null,
  cancha         integer,
  programado_at  timestamptz,
  estado         text not null default 'programado'
                   check (estado in ('programado','en_vivo','finalizado','wo')),
  sets           jsonb not null default '[]'::jsonb,
  ganador_id     uuid references public.equipos_torneo (id) on delete set null,
  sala_marcador  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists encuentros_torneo_idx    on public.encuentros (torneo_id);
create index if not exists encuentros_categoria_idx on public.encuentros (categoria_id);
create index if not exists encuentros_tenant_idx    on public.encuentros (tenant_id);
create index if not exists encuentros_estado_idx    on public.encuentros (estado);

drop trigger if exists encuentros_set_updated_at on public.encuentros;
create trigger encuentros_set_updated_at
  before update on public.encuentros
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.encuentros enable row level security;

drop policy if exists "encuentros_tenant_rw" on public.encuentros;
create policy "encuentros_tenant_rw" on public.encuentros for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- Fixture y marcadores son públicos (equipos, horarios y sets; sin datos
-- personales) en los torneos ya visibles. Lo necesita el tiempo real.
drop policy if exists "encuentros_public_select" on public.encuentros;
create policy "encuentros_public_select" on public.encuentros for select
  to anon using (
    exists (
      select 1 from public.torneos t
      where t.id = encuentros.torneo_id
        and t.estado in ('inscripciones','programado','en_curso','finalizado')
    )
  );
