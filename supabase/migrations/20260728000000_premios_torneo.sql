-- =============================================================================
-- Torneos — premiación estructurada por puesto
-- =============================================================================
-- La premiación era un texto libre (`torneos.premiacion_descripcion`): no se
-- podía ordenar, ni sumar, ni pintar como lista en la página pública. Ahora es
-- una lista de premios por puesto (1°, 2°, 3°…), donde cada torneo premia
-- tantos puestos como quiera.
--
-- `premiacion_descripcion` se conserva como NOTA opcional ("todos reciben
-- medalla", "el goleador se lleva un balón"), no como la premiación completa.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.premios_torneo (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  torneo_id   uuid not null references public.torneos (id) on delete cascade,
  -- 1 = campeón, 2 = subcampeón, 3 = tercer puesto…
  puesto      integer not null check (puesto > 0),
  tipo        text not null check (tipo in ('valor', 'producto')),
  descripcion text not null,
  -- Solo cuando `tipo = 'valor'`: alimenta el costo real de la premiación.
  valor       integer check (valor is null or valor >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (torneo_id, puesto)   -- un solo premio por puesto
);

create index if not exists premios_torneo_torneo_idx on public.premios_torneo (torneo_id);
create index if not exists premios_torneo_tenant_idx on public.premios_torneo (tenant_id);

drop trigger if exists premios_torneo_set_updated_at on public.premios_torneo;
create trigger premios_torneo_set_updated_at
  before update on public.premios_torneo
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.premios_torneo enable row level security;

-- El organizador administra los premios de sus torneos.
drop policy if exists "premios_torneo_tenant_rw" on public.premios_torneo;
create policy "premios_torneo_tenant_rw" on public.premios_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- El público los lee: la premiación es justamente lo que decide inscribirse.
-- Solo de torneos ya visibles (misma regla que la policy de `torneos`).
drop policy if exists "premios_torneo_public_select" on public.premios_torneo;
create policy "premios_torneo_public_select" on public.premios_torneo for select
  to anon using (
    exists (
      select 1 from public.torneos t
      where t.id = premios_torneo.torneo_id
        and t.estado in ('inscripciones','programado','en_curso','finalizado')
    )
  );
