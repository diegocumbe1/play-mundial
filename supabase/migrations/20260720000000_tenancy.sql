-- =============================================================================
-- Rifas — Fase 0: Tenancy (organizadores, membresías, config de pago por tenant)
-- =============================================================================
-- Convierte la app single-tenant en plataforma multi-tenant.
--   tenants           = organizador (dueño de sus rifas)
--   memberships       = auth.user ↔ tenant con rol (superadmin | owner)
--   tenant_pago_config= datos de cobro por tenant (reemplaza POLLA.banco fijo)
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_membership') then
    create type public.rol_membership as enum ('superadmin', 'owner');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_tenant') then
    create type public.estado_tenant as enum ('activo', 'archivado');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text unique not null,
  estado     public.estado_tenant not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  rol        public.rol_membership not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_tenant_idx on public.memberships (tenant_id);

create table if not exists public.tenant_pago_config (
  tenant_id   uuid primary key references public.tenants (id) on delete cascade,
  nequi_llave text,
  titular     text,
  qr_url      text,
  whatsapp    text,
  mensaje_qr  text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_pago_config_set_updated_at on public.tenant_pago_config;
create trigger tenant_pago_config_set_updated_at
  before update on public.tenant_pago_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de RLS (SECURITY DEFINER: leen memberships sin recursión de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.rol = 'superadmin'
  );
$$;

create or replace function public.es_miembro(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.es_superadmin() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = t
  );
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.tenants            enable row level security;
alter table public.memberships        enable row level security;
alter table public.tenant_pago_config enable row level security;

-- tenants: el miembro ve su tenant; superadmin ve todo. Escritura solo superadmin.
drop policy if exists "tenants_select_miembro" on public.tenants;
create policy "tenants_select_miembro" on public.tenants for select
  to authenticated using (public.es_miembro(id));
drop policy if exists "tenants_super_write" on public.tenants;
create policy "tenants_super_write" on public.tenants for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

-- memberships: cada quien ve las suyas; superadmin ve todas. Escritura solo superadmin.
drop policy if exists "memberships_select_propias" on public.memberships;
create policy "memberships_select_propias" on public.memberships for select
  to authenticated using (user_id = auth.uid() or public.es_superadmin());
drop policy if exists "memberships_super_write" on public.memberships;
create policy "memberships_super_write" on public.memberships for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

-- tenant_pago_config: datos de cobro visibles al PÚBLICO (la página pública de la
-- rifa y el flyer muestran cómo pagar). Escritura solo miembro del tenant.
drop policy if exists "pago_config_select_public" on public.tenant_pago_config;
create policy "pago_config_select_public" on public.tenant_pago_config for select
  to anon, authenticated using (true);
drop policy if exists "pago_config_write_miembro" on public.tenant_pago_config;
create policy "pago_config_write_miembro" on public.tenant_pago_config for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));
