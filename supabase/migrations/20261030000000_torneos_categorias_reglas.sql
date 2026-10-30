-- =============================================================================
-- Torneos — categorías, reglas configurables y plantillas por deporte
-- =============================================================================
-- Un torneo real (ej. Torneo Familia Fase 4) tiene VARIAS categorías (3 vs 3 y
-- 5 vs 5), cada una con su cupo, su inscripción y su propia premiación. Y sus
-- reglas (sets, puntos, quién puede jugar, qué pasa con la premiación) las
-- responde el organizador desde la plataforma, no se escriben en código.
--
-- - `categorias_torneo`: divisiones del torneo.
-- - `equipos_torneo.categoria_id` / `premios_torneo.categoria_id`: a qué
--   categoría pertenece cada equipo y cada premio (NULL = torneo sin categorías).
-- - `torneos.reglas` (jsonb): respuestas del organizador; la forma la valida
--   zod en `src/lib/torneo-reglas.ts`.
-- - `plantillas_torneo`: respuestas sugeridas por deporte. Se editan desde la
--   base (superadmin) sin desplegar código.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
create table if not exists public.categorias_torneo (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  torneo_id           uuid not null references public.torneos (id) on delete cascade,
  nombre              text not null,                 -- "3 vs 3", "5 vs 5", "Sub-17"
  jugadores_en_cancha integer check (jugadores_en_cancha is null or jugadores_en_cancha > 0),
  max_jugadores       integer check (max_jugadores is null or max_jugadores > 0),
  cupo_equipos        integer not null check (cupo_equipos > 1),
  -- NULL = usa `torneos.valor_inscripcion`.
  valor_inscripcion   integer check (valor_inscripcion is null or valor_inscripcion >= 0),
  orden               integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (torneo_id, nombre)
);

create index if not exists categorias_torneo_torneo_idx on public.categorias_torneo (torneo_id);
create index if not exists categorias_torneo_tenant_idx on public.categorias_torneo (tenant_id);

drop trigger if exists categorias_torneo_set_updated_at on public.categorias_torneo;
create trigger categorias_torneo_set_updated_at
  before update on public.categorias_torneo
  for each row execute function public.set_updated_at();

alter table public.equipos_torneo
  add column if not exists categoria_id uuid references public.categorias_torneo (id) on delete set null;
create index if not exists equipos_torneo_categoria_idx on public.equipos_torneo (categoria_id);

-- Premios por categoría: el puesto deja de ser único por torneo y pasa a ser
-- único por (torneo, categoría). Los torneos sin categorías siguen igual.
alter table public.premios_torneo
  add column if not exists categoria_id uuid references public.categorias_torneo (id) on delete cascade;
alter table public.premios_torneo
  drop constraint if exists premios_torneo_torneo_id_puesto_key;
create unique index if not exists premios_torneo_puesto_unico
  on public.premios_torneo (
    torneo_id,
    coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid),
    puesto
  );

-- ---------------------------------------------------------------------------
-- Reglas del torneo
-- ---------------------------------------------------------------------------
alter table public.torneos
  add column if not exists reglas    jsonb not null default '{}'::jsonb,
  add column if not exists plantilla text;

-- ---------------------------------------------------------------------------
-- Plantillas por deporte
-- ---------------------------------------------------------------------------
create table if not exists public.plantillas_torneo (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  nombre      text not null,
  deporte     text not null,
  descripcion text,
  -- { formato, categorias: [...], reglas: {...} } — ver src/lib/torneo-reglas.ts
  config      jsonb not null default '{}'::jsonb,
  activa      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists plantillas_torneo_set_updated_at on public.plantillas_torneo;
create trigger plantillas_torneo_set_updated_at
  before update on public.plantillas_torneo
  for each row execute function public.set_updated_at();

insert into public.plantillas_torneo (slug, nombre, deporte, descripcion, config, orden)
values (
  'voleiplaya',
  'Voleiplaya recreativo',
  'Voleiplaya',
  'Mejor de 3 sets a 21, set decisivo a 15, diferencia de 2. Tabla: victoria 2, derrota 1, W.O. 0.',
  '{
    "formato": "grupos_eliminacion",
    "categorias": [
      {"nombre": "3 vs 3", "jugadores_en_cancha": 3, "max_jugadores": 5, "cupo_equipos": 12},
      {"nombre": "5 vs 5", "jugadores_en_cancha": 5, "max_jugadores": 8, "cupo_equipos": 16}
    ],
    "reglas": {
      "juego": {
        "sets": 3, "puntos_set": 21, "puntos_decisivo": 15, "diferencia_dos": true,
        "tope_puntos": null, "cambio_lado_cada": 7, "tiempos_por_set": 1,
        "tolerancia_wo_min": 10
      },
      "tabla": {"victoria": 2, "derrota": 1, "wo": 0},
      "participacion": {
        "solo_clientes": false, "como_verificar_cliente": "",
        "max_externos": null, "max_referentes": null, "que_es_referente": "",
        "min_mujeres_cancha": 0, "jugador_varias_categorias": false,
        "edad_minima": null
      },
      "premiacion": {"politica": "garantizada", "minimo_equipos": null,
        "entrega": "Al terminar la final de cada categoría."},
      "reembolso": {"politica": "hasta_cierre"}
    }
  }'::jsonb,
  1
)
on conflict (slug) do nothing;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.categorias_torneo enable row level security;
alter table public.plantillas_torneo enable row level security;

drop policy if exists "categorias_torneo_tenant_rw" on public.categorias_torneo;
create policy "categorias_torneo_tenant_rw" on public.categorias_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- Las categorías se publican junto con el torneo (misma regla que `torneos`).
drop policy if exists "categorias_torneo_public_select" on public.categorias_torneo;
create policy "categorias_torneo_public_select" on public.categorias_torneo for select
  to anon using (
    exists (
      select 1 from public.torneos t
      where t.id = categorias_torneo.torneo_id
        and t.estado in ('inscripciones','programado','en_curso','finalizado')
    )
  );

-- Plantillas: cualquier organizador las lee; solo el superadmin las edita.
drop policy if exists "plantillas_torneo_select" on public.plantillas_torneo;
create policy "plantillas_torneo_select" on public.plantillas_torneo for select
  to authenticated using (true);

drop policy if exists "plantillas_torneo_super_write" on public.plantillas_torneo;
create policy "plantillas_torneo_super_write" on public.plantillas_torneo for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());
