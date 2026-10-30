-- =============================================================================
-- Rifas — Borrado forzado por superadmin, con rastro
-- =============================================================================
-- El organizador solo puede borrar rifas en borrador y sin números vendidos
-- (trigger `rifas_proteger_borrado`). El superadmin necesita a veces borrar una
-- publicada (duplicadas, pruebas, errores). Lo hace por el backend (service
-- role, que el trigger deja pasar) y con un MOTIVO obligatorio que queda aquí,
-- junto a una foto de lo que se borró: no se puede deshacer, pero sí explicar.
-- Idempotente.
-- =============================================================================

create table if not exists public.rifas_borradas (
  id              uuid primary key default gen_random_uuid(),
  rifa_id         uuid not null,
  tenant_id       uuid,
  nombre          text not null,
  estado          text not null,
  numeros_vendidos integer not null default 0,
  numeros_pagados integer not null default 0,
  recaudado       integer not null default 0,
  motivo          text not null check (length(trim(motivo)) >= 10),
  borrado_por     uuid,
  borrado_por_email text,
  created_at      timestamptz not null default now()
);

create index if not exists rifas_borradas_tenant_idx on public.rifas_borradas (tenant_id);

-- Solo el superadmin la lee; se escribe desde el backend (service role).
alter table public.rifas_borradas enable row level security;

drop policy if exists "rifas_borradas_superadmin" on public.rifas_borradas;
create policy "rifas_borradas_superadmin" on public.rifas_borradas for select
  to authenticated using (public.es_superadmin());
