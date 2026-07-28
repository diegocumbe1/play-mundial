-- =============================================================================
-- Monetización multi-producto — el ledger y los precios dejan de ser solo rifas
-- =============================================================================
-- El ledger `cobros` ya existía atado a `rifa_id`. Aquí se generaliza para que
-- una misma mecánica (prepago manual → confirma el superadmin → se activa)
-- sirva a cualquier vertical, empezando por torneos.
--
-- Los MONTOS siguen sin hardcodearse: viven en `plataforma_config` y los edita
-- el superadmin en /superadmin/settings. Los escalones de torneo nacen en 0.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ledger: a qué producto y a qué entidad corresponde el cobro
-- ---------------------------------------------------------------------------
alter table public.cobros
  add column if not exists producto  text not null default 'rifas',
  add column if not exists torneo_id uuid references public.torneos (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobros_producto_check'
  ) then
    alter table public.cobros
      add constraint cobros_producto_check check (producto in ('rifas','torneos'));
  end if;
end $$;

create index if not exists cobros_tenant_idx   on public.cobros (tenant_id);
create index if not exists cobros_torneo_idx   on public.cobros (torneo_id);
create index if not exists cobros_producto_idx on public.cobros (producto);

-- ---------------------------------------------------------------------------
-- Precios y capa gratuita de la vertical torneos (escalones por cupo de equipos)
-- ---------------------------------------------------------------------------
alter table public.plataforma_config
  add column if not exists precio_torneo_8       integer not null default 0,  -- hasta 8 equipos
  add column if not exists precio_torneo_16      integer not null default 0,  -- 9–16 equipos
  add column if not exists precio_torneo_32      integer not null default 0,  -- 17–32 equipos
  add column if not exists precio_torneo_mas     integer not null default 0,  -- más de 32
  add column if not exists free_torneos_por_mes  integer not null default 1,
  add column if not exists free_torneos_total    integer not null default 2,
  add column if not exists free_max_equipos      integer not null default 8;

-- ---------------------------------------------------------------------------
-- Cuota gratuita de torneos (espeja `puede_crear_gratis` de rifas).
-- Los límites salen de plataforma_config: nada hardcodeado.
-- ---------------------------------------------------------------------------
create or replace function public.puede_crear_torneo_gratis(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.torneos r
       where r.tenant_id = t and r.cobro_tipo = 'gratis')
    < (select free_torneos_total from public.plataforma_config)
  ) and (
    (select count(*) from public.torneos r
       where r.tenant_id = t and r.cobro_tipo = 'gratis'
         and date_trunc('month', r.activado_at) = date_trunc('month', now()))
    < (select free_torneos_por_mes from public.plataforma_config)
  );
$$;
