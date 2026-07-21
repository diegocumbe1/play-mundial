-- =============================================================================
-- Rifas — Fase 1b: Monetización (planes, cobros, config de plataforma editable)
-- =============================================================================
-- Requiere tenancy + rifas. Idempotente / re-ejecutable.
--   plataforma_config = precios y reglas del free EDITABLES por el superadmin
--   tenants.plan_actual / suscripcion_vence_at
--   rifas.cobro_tipo / activada_at
--   cobros            = ledger de pagos (prepago manual vía Nequi al inicio)
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tenant') then
    create type public.plan_tenant as enum ('gratis','pago_rifa','suscripcion');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_cobro') then
    create type public.estado_cobro as enum ('pendiente','pagado','anulado');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Config de plataforma EDITABLE por el superadmin (fila única).
-- Nada de precios ni reglas del free hardcodeados: todo se lee de aquí.
-- ---------------------------------------------------------------------------
create table if not exists public.plataforma_config (
  id                     boolean primary key default true check (id),  -- fuerza 1 fila
  moneda                 text not null default 'COP',
  precio_rifa_100        integer not null default 0,   -- rifa hasta 100 números
  precio_rifa_500        integer not null default 0,   -- rifa 101–500 números
  precio_suscripcion_mes integer not null default 0,
  free_rifas_por_mes     integer not null default 1,
  free_rifas_total       integer not null default 2,
  free_max_numeros       integer not null default 100,
  updated_at             timestamptz not null default now()
);

insert into public.plataforma_config (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists plataforma_config_set_updated_at on public.plataforma_config;
create trigger plataforma_config_set_updated_at
  before update on public.plataforma_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plan por tenant + cómo se pagó cada rifa
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists plan_actual public.plan_tenant not null default 'gratis',
  add column if not exists suscripcion_vence_at timestamptz;

alter table public.rifas
  add column if not exists cobro_tipo public.plan_tenant,  -- cómo se pagó ESTA rifa
  add column if not exists activada_at timestamptz;

-- ---------------------------------------------------------------------------
-- Ledger de cobros
-- ---------------------------------------------------------------------------
create table if not exists public.cobros (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  rifa_id     uuid references public.rifas (id) on delete set null,
  tipo        public.plan_tenant not null,       -- pago_rifa | suscripcion
  monto       integer not null check (monto >= 0),
  estado      public.estado_cobro not null default 'pendiente',
  periodo     text,                              -- 'YYYY-MM' para suscripción
  comprobante text,                              -- nota/URL del pago manual
  created_at  timestamptz not null default now(),
  pagado_at   timestamptz
);

create index if not exists cobros_tenant_idx on public.cobros (tenant_id);
create index if not exists cobros_estado_idx on public.cobros (estado);

-- ---------------------------------------------------------------------------
-- Cuota de capa gratuita: límites tomados de plataforma_config (editables).
-- ---------------------------------------------------------------------------
create or replace function public.puede_crear_gratis(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (
    (select count(*) from public.rifas r
       where r.tenant_id = t and r.cobro_tipo = 'gratis')
    < (select free_rifas_total from public.plataforma_config)
  ) and (
    (select count(*) from public.rifas r
       where r.tenant_id = t and r.cobro_tipo = 'gratis'
         and date_trunc('month', r.activada_at) = date_trunc('month', now()))
    < (select free_rifas_por_mes from public.plataforma_config)
  );
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.plataforma_config enable row level security;
alter table public.cobros            enable row level security;

-- plataforma_config: lectura pública (para pintar precios); escritura solo superadmin.
drop policy if exists "config_select_public" on public.plataforma_config;
create policy "config_select_public" on public.plataforma_config for select
  to anon, authenticated using (true);
drop policy if exists "config_super_write" on public.plataforma_config;
create policy "config_super_write" on public.plataforma_config for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

-- cobros: el miembro ve los suyos; escritura (confirmar pago) solo superadmin.
drop policy if exists "cobros_select_miembro" on public.cobros;
create policy "cobros_select_miembro" on public.cobros for select
  to authenticated using (public.es_miembro(tenant_id));
drop policy if exists "cobros_super_write" on public.cobros;
create policy "cobros_super_write" on public.cobros for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());
