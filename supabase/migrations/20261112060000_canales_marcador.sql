-- =============================================================================
-- Canales del marcador — una sala FIJA por cancha para todo el torneo
-- =============================================================================
-- Cada cancha tiene una sala permanente (`sala`): la TV y el juez usan SIEMPRE el mismo
-- enlace. El torneo la reconfigura partido a partido («Siguiente partido»). `encuentro_id`
-- es el partido que está cargado ahora. El código de sala es el secreto del enlace:
-- largo e imposible de adivinar; se puede regenerar.
-- Acceso solo por servicio: RLS activa y SIN políticas. Idempotente.
-- =============================================================================
create table if not exists public.canales_marcador (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  torneo_id    uuid not null references public.torneos (id) on delete cascade,
  cancha       integer not null check (cancha >= 1),
  sala         text not null unique,
  encuentro_id uuid references public.encuentros (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (torneo_id, cancha)
);

create index if not exists canales_marcador_torneo_idx on public.canales_marcador (torneo_id);

drop trigger if exists canales_marcador_set_updated_at on public.canales_marcador;
create trigger canales_marcador_set_updated_at
  before update on public.canales_marcador
  for each row execute function public.set_updated_at();

alter table public.canales_marcador enable row level security;
