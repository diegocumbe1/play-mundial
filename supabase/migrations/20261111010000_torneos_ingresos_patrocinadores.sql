-- =============================================================================
-- Torneos — otros ingresos y patrocinadores
-- =============================================================================
-- 1. `ingresos_torneo`: dinero que entra aparte de las inscripciones
--    (arbitraje cobrado, aportes de patrocinadores, otros). Interno: nunca
--    sale del tenant. Un ingreso de arbitraje puede quedar ligado al partido
--    donde se cobró (`encuentro_id`, uno por partido).
-- 2. `patrocinadores_torneo`: quién organiza, gestiona o patrocina cada
--    torneo, con su logo. Solo los `publicado` se muestran en la página
--    pública, y solo si el superadmin habilitó la función al organizador
--    (`tenants.patrocinios_habilitado`). La página pública lee con service
--    role, así que `anon` no tiene acceso directo a la tabla.
-- 3. `tenants.patrocinios_habilitado`: interruptor del superadmin.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.tenants
  add column if not exists patrocinios_habilitado boolean not null default false;

-- ---------------------------------------------------------------------------
-- Patrocinadores (antes que ingresos: un ingreso puede apuntar a uno)
-- ---------------------------------------------------------------------------
create table if not exists public.patrocinadores_torneo (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  torneo_id   uuid not null references public.torneos (id) on delete cascade,
  nombre      text not null,
  -- organiza | gestor | patrocinador (como «Organiza · Gestores y patrocinadores»)
  rol         text not null default 'patrocinador'
                check (rol in ('organiza', 'gestor', 'patrocinador')),
  logo_url    text,
  enlace      text,
  -- Lo que aportó en dinero (informativo; el dinero real se registra como ingreso).
  aporte      integer check (aporte is null or aporte >= 0),
  estado      text not null default 'borrador' check (estado in ('borrador', 'publicado')),
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists patrocinadores_torneo_torneo_idx on public.patrocinadores_torneo (torneo_id);
create index if not exists patrocinadores_torneo_tenant_idx on public.patrocinadores_torneo (tenant_id);

drop trigger if exists patrocinadores_torneo_set_updated_at on public.patrocinadores_torneo;
create trigger patrocinadores_torneo_set_updated_at
  before update on public.patrocinadores_torneo
  for each row execute function public.set_updated_at();

alter table public.patrocinadores_torneo enable row level security;
drop policy if exists "patrocinadores_torneo_tenant_rw" on public.patrocinadores_torneo;
create policy "patrocinadores_torneo_tenant_rw" on public.patrocinadores_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- ---------------------------------------------------------------------------
-- Otros ingresos
-- ---------------------------------------------------------------------------
create table if not exists public.ingresos_torneo (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  torneo_id        uuid not null references public.torneos (id) on delete cascade,
  tipo             text not null check (tipo in ('arbitraje', 'patrocinio', 'otro')),
  descripcion      text,
  valor            integer not null check (valor >= 0),
  recibido         boolean not null default true,
  fecha            date not null default (now() at time zone 'America/Bogota')::date,
  patrocinador_id  uuid references public.patrocinadores_torneo (id) on delete set null,
  encuentro_id     uuid references public.encuentros (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ingresos_torneo_torneo_idx on public.ingresos_torneo (torneo_id);
create index if not exists ingresos_torneo_tenant_idx on public.ingresos_torneo (tenant_id);
-- Un solo ingreso de arbitraje por partido.
create unique index if not exists ingresos_torneo_encuentro_uidx
  on public.ingresos_torneo (encuentro_id) where encuentro_id is not null;

drop trigger if exists ingresos_torneo_set_updated_at on public.ingresos_torneo;
create trigger ingresos_torneo_set_updated_at
  before update on public.ingresos_torneo
  for each row execute function public.set_updated_at();

alter table public.ingresos_torneo enable row level security;
drop policy if exists "ingresos_torneo_tenant_rw" on public.ingresos_torneo;
create policy "ingresos_torneo_tenant_rw" on public.ingresos_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- Los logos van al bucket público existente `rifa-imagenes` (el de las rifas),
-- separados por carpeta: {tenant_id}/torneos/{torneo_id}/patrocinadores/…
