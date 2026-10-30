-- =============================================================================
-- Torneos — plantilla de jugadores por equipo
-- =============================================================================
-- Cada equipo inscribe a sus jugadores con nombre y documento. Es lo que
-- permite validar de verdad las reglas del torneo (máximo de externos y de
-- referentes, mínimo de mujeres, un jugador en un solo equipo) y lo que el
-- organizador revisa en la cancha.
--
-- Documento, género y referencia de cliente son datos personales: SIN acceso
-- `anon`. La página pública nunca los muestra.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.jugadores_torneo (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  torneo_id          uuid not null references public.torneos (id) on delete cascade,
  equipo_id          uuid not null references public.equipos_torneo (id) on delete cascade,
  nombre             text not null,
  documento          text not null,
  genero             text not null check (genero in ('femenino','masculino')),
  -- No es cliente del organizador (solo aplica en torneos "exclusivo para clientes").
  es_externo         boolean not null default false,
  es_referente       boolean not null default false,
  -- Cómo demuestra que es cliente (factura, membresía…).
  referencia_cliente text,
  orden              integer not null default 0,
  created_at         timestamptz not null default now(),
  unique (equipo_id, documento)
);

create index if not exists jugadores_torneo_equipo_idx    on public.jugadores_torneo (equipo_id);
create index if not exists jugadores_torneo_documento_idx on public.jugadores_torneo (torneo_id, documento);
create index if not exists jugadores_torneo_tenant_idx    on public.jugadores_torneo (tenant_id);

alter table public.jugadores_torneo enable row level security;

drop policy if exists "jugadores_torneo_tenant_rw" on public.jugadores_torneo;
create policy "jugadores_torneo_tenant_rw" on public.jugadores_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));
