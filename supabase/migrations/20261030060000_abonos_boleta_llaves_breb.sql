-- =============================================================================
-- Rifas — Abonos por boleta (separar con saldo) + varias llaves Bre-B
-- =============================================================================
-- 1) ABONOS. Hay rifas caras ($150.000 el puesto) que se pagan por partes:
--    "separa con $50.000 y abona $50.000 cada 15 días". Cada abono es una fila
--    en `abonos_boleta`; la boleta guarda el total (`monto_abonado`) y cuánto de
--    eso fue en efectivo (`abonado_efectivo`) para el cuadre de caja. Los
--    recalcula el servidor después de cada abono, igual que en torneos.
--    Cuando lo abonado alcanza el precio del puesto, la boleta pasa a `pagado`.
--    Mientras tanto sigue `reservado`: con "solo pagadas juegan", no juega.
--
-- 2) LLAVES BRE-B. Un organizador puede recibir en más de una llave (una por
--    banco). `llave` sigue siendo la principal; `llaves_adicionales` las demás.
-- Idempotente / re-ejecutable.
-- =============================================================================

alter table public.boletas
  add column if not exists monto_abonado integer not null default 0,
  add column if not exists abonado_efectivo integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'boletas_monto_abonado_check') then
    alter table public.boletas
      add constraint boletas_monto_abonado_check
      check (monto_abonado >= 0 and abonado_efectivo >= 0 and abonado_efectivo <= monto_abonado);
  end if;
end $$;

create table if not exists public.abonos_boleta (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  rifa_id     uuid not null references public.rifas (id) on delete cascade,
  boleta_id   uuid not null references public.boletas (id) on delete cascade,
  monto       integer not null check (monto > 0),
  metodo      text not null check (metodo in ('efectivo','transferencia')),
  nota        text,
  created_at  timestamptz not null default now()
);

create index if not exists abonos_boleta_boleta_idx on public.abonos_boleta (boleta_id);
create index if not exists abonos_boleta_rifa_idx on public.abonos_boleta (rifa_id);
create index if not exists abonos_boleta_tenant_idx on public.abonos_boleta (tenant_id);

-- Dinero de compradores: solo el organizador (y el superadmin vía es_miembro).
alter table public.abonos_boleta enable row level security;

drop policy if exists "abonos_boleta_tenant_rw" on public.abonos_boleta;
create policy "abonos_boleta_tenant_rw" on public.abonos_boleta for all
  to authenticated using (public.es_miembro(tenant_id)) with check (public.es_miembro(tenant_id));

alter table public.tenant_pago_config
  add column if not exists llaves_adicionales text[] not null default '{}';
