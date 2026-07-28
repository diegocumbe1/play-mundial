-- =============================================================================
-- Vertical "Torneos deportivos" — dominio (torneos, equipos, gastos)
-- =============================================================================
-- Requiere 20260720000000_tenancy.sql (tenants, es_miembro, es_superadmin) y
-- 20260727000000_tenant_productos.sql.
--
-- El organizador (tenant) crea campeonatos de cualquier deporte, cobra
-- inscripciones, registra gastos y mide rentabilidad. El fixture llega después:
-- esta migración cubre el MVP administrativo y financiero.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_torneo') then
    create type public.estado_torneo as enum
      ('borrador','inscripciones','programado','en_curso','finalizado','cancelado');
  end if;
  if not exists (select 1 from pg_type where typname = 'formato_torneo') then
    create type public.formato_torneo as enum
      ('todos_contra_todos','eliminacion_directa','grupos_eliminacion','personalizado');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_equipo_torneo') then
    create type public.estado_equipo_torneo as enum
      ('pendiente','confirmado','rechazado','retirado');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.torneos (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants (id) on delete cascade,
  nombre                    text not null,
  slug_publico              text unique not null,
  -- Identidad deportiva
  deporte                   text not null,          -- futbol, voleibol, voleiplaya, baloncesto, padel...
  modalidad                 text,                   -- 5x5, 7x7, arena, dobles...
  categoria                 text,                   -- libre, sub-17, veteranos...
  rama                      text,                   -- masculina, femenina, mixta
  formato                   public.formato_torneo not null default 'todos_contra_todos',
  estado                    public.estado_torneo not null default 'borrador',
  -- Lugar y fechas
  ciudad                    text,
  escenario                 text,
  direccion                 text,
  fecha_inicio              date,
  fecha_fin                 date,
  cierre_inscripciones      timestamptz,
  -- Operación
  cupo_equipos              integer not null check (cupo_equipos > 1),
  minimo_equipos            integer check (minimo_equipos is null or minimo_equipos > 1),
  jugadores_por_equipo      integer check (jugadores_por_equipo is null or jugadores_por_equipo > 0),
  duracion_partido_minutos  integer check (duracion_partido_minutos is null or duracion_partido_minutos > 0),
  cantidad_canchas          integer not null default 1 check (cantidad_canchas > 0),
  -- Finanzas y comunicación
  valor_inscripcion         integer not null default 0 check (valor_inscripcion >= 0),
  reglamento                text,
  premiacion_descripcion    text,
  tema                      text not null default 'clasico',
  -- Monetización (espeja `rifas`: cómo se pagó ESTE torneo)
  cobro_tipo                public.plan_tenant,
  activado_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- El mínimo nunca puede exigir más equipos que el cupo.
  constraint torneos_minimo_menor_cupo
    check (minimo_equipos is null or minimo_equipos <= cupo_equipos)
);

create index if not exists torneos_tenant_idx on public.torneos (tenant_id);
create index if not exists torneos_estado_idx on public.torneos (estado);
create index if not exists torneos_slug_idx   on public.torneos (slug_publico);

create table if not exists public.equipos_torneo (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  torneo_id             uuid not null references public.torneos (id) on delete cascade,
  nombre                text not null,
  escudo_url            text,
  -- Datos personales del responsable: NUNCA salen a vistas públicas.
  responsable_nombre    text,
  responsable_telefono  text,
  responsable_correo    text,
  cantidad_jugadores    integer check (cantidad_jugadores is null or cantidad_jugadores > 0),
  estado                public.estado_equipo_torneo not null default 'pendiente',
  monto_inscripcion     integer check (monto_inscripcion is null or monto_inscripcion >= 0),
  monto_pagado          integer not null default 0 check (monto_pagado >= 0),
  metodo_pago           text check (metodo_pago is null or metodo_pago in ('efectivo','transferencia')),
  comprobante_url       text,
  consentimiento_datos  boolean not null default false,
  confirmado_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (torneo_id, nombre)   -- no se inscribe dos veces el mismo equipo
);

create index if not exists equipos_torneo_tenant_idx on public.equipos_torneo (tenant_id);
create index if not exists equipos_torneo_torneo_idx on public.equipos_torneo (torneo_id);
create index if not exists equipos_torneo_estado_idx on public.equipos_torneo (estado);

create table if not exists public.gastos_torneo (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  torneo_id      uuid not null references public.torneos (id) on delete cascade,
  -- Categoría sugerida (alquiler_cancha, arbitraje, premiacion, trofeos,
  -- medallas, hidratacion, uniformes, publicidad, fotografia, transmision,
  -- sonido, ambulancia, personal, logistica, transporte, impuestos,
  -- imprevistos, otro). Texto libre para no bloquear casos reales.
  categoria      text not null,
  descripcion    text,
  cantidad       numeric check (cantidad is null or cantidad > 0),
  valor_unitario integer check (valor_unitario is null or valor_unitario >= 0),
  valor_total    integer not null check (valor_total >= 0),
  pagado         boolean not null default false,
  proveedor      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists gastos_torneo_tenant_idx    on public.gastos_torneo (tenant_id);
create index if not exists gastos_torneo_torneo_idx    on public.gastos_torneo (torneo_id);
create index if not exists gastos_torneo_categoria_idx on public.gastos_torneo (categoria);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists torneos_set_updated_at on public.torneos;
create trigger torneos_set_updated_at
  before update on public.torneos
  for each row execute function public.set_updated_at();

drop trigger if exists equipos_torneo_set_updated_at on public.equipos_torneo;
create trigger equipos_torneo_set_updated_at
  before update on public.equipos_torneo
  for each row execute function public.set_updated_at();

drop trigger if exists gastos_torneo_set_updated_at on public.gastos_torneo;
create trigger gastos_torneo_set_updated_at
  before update on public.gastos_torneo
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.torneos        enable row level security;
alter table public.equipos_torneo enable row level security;
alter table public.gastos_torneo  enable row level security;

-- torneos: miembro/superadmin acceso total; el público solo ve los ya visibles.
drop policy if exists "torneos_tenant_rw" on public.torneos;
create policy "torneos_tenant_rw" on public.torneos for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

drop policy if exists "torneos_public_select" on public.torneos;
create policy "torneos_public_select" on public.torneos for select
  to anon using (estado in ('inscripciones','programado','en_curso','finalizado'));

-- equipos_torneo: SIN acceso `anon`. Guarda responsable, teléfono, correo,
-- comprobante y montos. La landing pública arma su corte seguro (id, nombre,
-- escudo) desde un Server Action con service role.
drop policy if exists "equipos_torneo_public_select" on public.equipos_torneo;
drop policy if exists "equipos_torneo_public_insert" on public.equipos_torneo;
drop policy if exists "equipos_torneo_tenant_rw" on public.equipos_torneo;
create policy "equipos_torneo_tenant_rw" on public.equipos_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

-- gastos_torneo: información interna de rentabilidad. Nunca sale del tenant.
drop policy if exists "gastos_torneo_public_select" on public.gastos_torneo;
drop policy if exists "gastos_torneo_tenant_rw" on public.gastos_torneo;
create policy "gastos_torneo_tenant_rw" on public.gastos_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));
