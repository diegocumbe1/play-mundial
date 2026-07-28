-- =============================================================================
-- Plataforma multi-producto — productos habilitados por tenant
-- =============================================================================
-- La plataforma deja de ser "solo rifas": cada organizador puede tener
-- habilitadas una o varias verticales (rifas, torneos, ...). El superadmin
-- administra qué ve cada quien; el owner solo consulta lo suyo.
--
-- Compatibilidad: se siembran filas para TODOS los tenants existentes con
-- ambos productos habilitados, para que nadie pierda el acceso a sus rifas.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.tenant_productos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  producto   text not null check (producto in ('rifas', 'torneos')),
  habilitado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, producto)
);

create index if not exists tenant_productos_tenant_idx
  on public.tenant_productos (tenant_id);
create index if not exists tenant_productos_producto_idx
  on public.tenant_productos (producto);

drop trigger if exists tenant_productos_set_updated_at on public.tenant_productos;
create trigger tenant_productos_set_updated_at
  before update on public.tenant_productos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: todo tenant existente conserva rifas y estrena torneos.
-- ---------------------------------------------------------------------------
insert into public.tenant_productos (tenant_id, producto, habilitado)
select t.id, p.producto, true
from public.tenants t
cross join (values ('rifas'), ('torneos')) as p(producto)
on conflict (tenant_id, producto) do nothing;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.tenant_productos enable row level security;

-- El miembro consulta los productos de su tenant (el superadmin, los de todos).
drop policy if exists "tenant_productos_select_miembro" on public.tenant_productos;
create policy "tenant_productos_select_miembro" on public.tenant_productos for select
  to authenticated using (public.es_miembro(tenant_id));

-- Habilitar/deshabilitar un producto es decisión del dueño de la plataforma.
drop policy if exists "tenant_productos_super_write" on public.tenant_productos;
create policy "tenant_productos_super_write" on public.tenant_productos for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());
