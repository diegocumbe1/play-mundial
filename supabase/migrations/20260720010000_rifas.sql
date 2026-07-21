-- =============================================================================
-- Rifas — Fase 1: Dominio de rifa (rifas, premios, boletas, ganadores)
-- =============================================================================
-- Requiere 20260720000000_tenancy.sql (tenants, es_miembro, es_superadmin).
-- Idempotente / re-ejecutable.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_rifa') then
    create type public.tipo_rifa as enum ('interna', 'loteria');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_rifa') then
    create type public.estado_rifa as enum
      ('borrador','activa','cerrada','sorteada','pagada','cancelada');
  end if;
  if not exists (select 1 from pg_type where typname = 'modo_cifras') then
    create type public.modo_cifras as enum ('primeras_dos','ultimas_dos','ambas');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_boleta') then
    create type public.estado_boleta as enum ('libre','reservado','pagado');
  end if;
  if not exists (select 1 from pg_type where typname = 'criterio_premio') then
    create type public.criterio_premio as enum ('primeras_2','ultimas_2');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.rifas (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  nombre              text not null,
  descripcion         text,
  tipo                public.tipo_rifa not null default 'interna',
  estado              public.estado_rifa not null default 'borrador',
  precio_boleta       integer not null check (precio_boleta >= 0),
  cantidad_numeros    integer not null check (cantidad_numeros > 0),
  formato_cifras      integer not null default 2 check (formato_cifras in (2,3)),
  solo_pagadas_juegan boolean not null default true,
  slug_publico        text unique not null,
  -- lotería:
  loteria             text,
  fecha_loteria       date,
  modo_cifras         public.modo_cifras,
  resultado_loteria   text,
  fecha_apertura      timestamptz,
  fecha_cierre        timestamptz,
  fecha_sorteo        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists rifas_tenant_idx on public.rifas (tenant_id);
create index if not exists rifas_estado_idx on public.rifas (estado);

create table if not exists public.premios (
  id                 uuid primary key default gen_random_uuid(),
  rifa_id            uuid not null references public.rifas (id) on delete cascade,
  tipo               text not null check (tipo in ('valor','producto')),
  descripcion        text not null,
  valor              integer,
  cantidad_ganadores integer not null default 1 check (cantidad_ganadores > 0),
  criterio           public.criterio_premio,
  orden              integer not null default 1,
  created_at         timestamptz not null default now()
);

create index if not exists premios_rifa_idx on public.premios (rifa_id);

create table if not exists public.boletas (
  id                   uuid primary key default gen_random_uuid(),
  rifa_id              uuid not null references public.rifas (id) on delete cascade,
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  numero               integer not null,
  estado               public.estado_boleta not null default 'libre',
  comprador_nombre     text,
  comprador_telefono   text,
  cliente_id           text,
  metodo_pago          text check (metodo_pago is null or metodo_pago in ('efectivo','transferencia')),
  nota                 text,
  consentimiento_datos boolean not null default false,
  pagado_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (rifa_id, numero)   -- evita vender el mismo número dos veces
);

create index if not exists boletas_rifa_idx on public.boletas (rifa_id);
create index if not exists boletas_tenant_idx on public.boletas (tenant_id);

create table if not exists public.ganadores (
  id                   uuid primary key default gen_random_uuid(),
  rifa_id              uuid not null references public.rifas (id) on delete cascade,
  premio_id            uuid not null references public.premios (id) on delete cascade,
  boleta_id            uuid references public.boletas (id) on delete set null,
  numero               integer not null,
  mensaje_felicitacion text,
  publicado            boolean not null default false,
  created_at           timestamptz not null default now()
);

create index if not exists ganadores_rifa_idx on public.ganadores (rifa_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists rifas_set_updated_at on public.rifas;
create trigger rifas_set_updated_at
  before update on public.rifas
  for each row execute function public.set_updated_at();

drop trigger if exists boletas_set_updated_at on public.boletas;
create trigger boletas_set_updated_at
  before update on public.boletas
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.rifas     enable row level security;
alter table public.premios   enable row level security;
alter table public.boletas   enable row level security;
alter table public.ganadores enable row level security;

-- rifas: miembro/superadmin acceso total; público lee solo rifas ya visibles.
drop policy if exists "rifas_tenant_rw" on public.rifas;
create policy "rifas_tenant_rw" on public.rifas for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));
drop policy if exists "rifas_public_select" on public.rifas;
create policy "rifas_public_select" on public.rifas for select
  to anon using (estado in ('activa','cerrada','sorteada','pagada'));

-- premios: miembro/superadmin total; público lee (para pintar premios en la rifa).
drop policy if exists "premios_tenant_rw" on public.premios;
create policy "premios_tenant_rw" on public.premios for all
  to authenticated using (
    exists (select 1 from public.rifas r where r.id = premios.rifa_id and public.es_miembro(r.tenant_id))
  ) with check (
    exists (select 1 from public.rifas r where r.id = premios.rifa_id and public.es_miembro(r.tenant_id))
  );
drop policy if exists "premios_public_select" on public.premios;
create policy "premios_public_select" on public.premios for select
  to anon using (
    exists (select 1 from public.rifas r
            where r.id = premios.rifa_id
              and r.estado in ('activa','cerrada','sorteada','pagada'))
  );

-- boletas: contienen datos personales (nombre/teléfono). El `anon` NO tiene
-- acceso directo (la anon key es pública). Todo lo público —pintar ocupado/libre
-- y reservar— pasa por Server Actions con service role, que devuelven solo un
-- corte seguro (numero + ocupado). Aquí solo el miembro del tenant lee/escribe.
-- (Nota: por esto la limpieza previa elimina las políticas anon si existían.)
drop policy if exists "boletas_public_select" on public.boletas;
drop policy if exists "boletas_public_insert" on public.boletas;
drop policy if exists "boletas_tenant_rw" on public.boletas;
create policy "boletas_tenant_rw" on public.boletas for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- ganadores: miembro/superadmin total; público lee solo los publicados.
drop policy if exists "ganadores_tenant_rw" on public.ganadores;
create policy "ganadores_tenant_rw" on public.ganadores for all
  to authenticated using (
    exists (select 1 from public.rifas r where r.id = ganadores.rifa_id and public.es_miembro(r.tenant_id))
  ) with check (
    exists (select 1 from public.rifas r where r.id = ganadores.rifa_id and public.es_miembro(r.tenant_id))
  );
drop policy if exists "ganadores_public_select" on public.ganadores;
create policy "ganadores_public_select" on public.ganadores for select
  to anon using (publicado = true);

-- ===========================================================================
-- Realtime: emitir cambios de `boletas` (grilla pública en vivo)
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'boletas'
  ) then
    alter publication supabase_realtime add table public.boletas;
  end if;
end $$;
