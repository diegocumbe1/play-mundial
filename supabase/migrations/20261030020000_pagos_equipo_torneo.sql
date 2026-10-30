-- =============================================================================
-- Torneos — abonos de inscripción (pagos parciales y divididos)
-- =============================================================================
-- Un equipo puede pagar en varias partes y por medios distintos: $100.000 en
-- efectivo hoy y $100.000 por transferencia la otra semana. Cada abono es una
-- fila; `equipos_torneo.monto_pagado` queda como el TOTAL (lo recalcula el
-- servidor después de cada abono), así los cálculos existentes no cambian.
--
-- Con esto Finanzas puede separar lo recibido en efectivo de lo recibido por
-- transferencia (cuadre de caja).
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.pagos_equipo_torneo (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  torneo_id       uuid not null references public.torneos (id) on delete cascade,
  equipo_id       uuid not null references public.equipos_torneo (id) on delete cascade,
  monto           integer not null check (monto > 0),
  metodo          text not null check (metodo in ('efectivo','transferencia')),
  fecha           timestamptz not null default now(),
  comprobante_url text,
  nota            text,
  created_at      timestamptz not null default now()
);

create index if not exists pagos_equipo_torneo_equipo_idx on public.pagos_equipo_torneo (equipo_id);
create index if not exists pagos_equipo_torneo_torneo_idx on public.pagos_equipo_torneo (torneo_id);
create index if not exists pagos_equipo_torneo_tenant_idx on public.pagos_equipo_torneo (tenant_id);

-- Lo ya registrado (un solo monto por equipo) pasa a ser su primer abono.
insert into public.pagos_equipo_torneo
  (tenant_id, torneo_id, equipo_id, monto, metodo, fecha, comprobante_url, nota)
select e.tenant_id, e.torneo_id, e.id, e.monto_pagado,
       coalesce(e.metodo_pago, 'transferencia'), e.updated_at, e.comprobante_url,
       'Pago registrado antes de los abonos'
from public.equipos_torneo e
where e.monto_pagado > 0
  and not exists (select 1 from public.pagos_equipo_torneo p where p.equipo_id = e.id);

-- ===========================================================================
-- Row Level Security: dinero y comprobantes, solo el organizador.
-- ===========================================================================
alter table public.pagos_equipo_torneo enable row level security;

drop policy if exists "pagos_equipo_torneo_tenant_rw" on public.pagos_equipo_torneo;
create policy "pagos_equipo_torneo_tenant_rw" on public.pagos_equipo_torneo for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));
