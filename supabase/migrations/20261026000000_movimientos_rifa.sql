-- =============================================================================
-- Movimientos de caja de una rifa (retiros y gastos)
-- =============================================================================
-- Lo recaudado no se queda quieto: el organizador retira plata o la gasta
-- (compra de premios, gastos del hogar…). Cada salida se registra aquí para
-- saber cuánto queda de lo reunido, separado por medio:
--   saldo efectivo      = boletas pagadas en efectivo      − salidas en efectivo
--   saldo transferencia = boletas pagadas por transferencia − salidas por transferencia
-- Las boletas pagadas sin medio (`metodo_pago` null, registros viejos) cuentan
-- como transferencia, que es el medio por defecto.
--
-- Solo uso interno del organizador: el público nunca lo ve.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.movimientos_rifa (
  id          uuid primary key default gen_random_uuid(),
  rifa_id     uuid not null references public.rifas (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  -- retiro = sacó la plata; gasto = se usó en algo (premios, etc.).
  tipo        text not null default 'retiro' check (tipo in ('retiro', 'gasto')),
  monto       integer not null check (monto > 0),
  -- De qué "caja" sale: lo cobrado en efectivo o lo que entró a la cuenta.
  metodo      text not null default 'transferencia'
                check (metodo in ('efectivo', 'transferencia')),
  detalle     text,
  created_at  timestamptz not null default now()
);

create index if not exists movimientos_rifa_rifa_idx on public.movimientos_rifa (rifa_id);

alter table public.movimientos_rifa enable row level security;

-- Igual que premios/ganadores: el miembro del tenant DUEÑO DE LA RIFA (o el
-- superadmin vía es_miembro) lee y escribe. El tenant_id debe coincidir con el
-- de la rifa para que nadie cuelgue movimientos en rifas ajenas.
drop policy if exists "movimientos_rifa_tenant_rw" on public.movimientos_rifa;
create policy "movimientos_rifa_tenant_rw" on public.movimientos_rifa for all
  to authenticated using (
    exists (select 1 from public.rifas r
            where r.id = movimientos_rifa.rifa_id and public.es_miembro(r.tenant_id))
  ) with check (
    exists (select 1 from public.rifas r
            where r.id = movimientos_rifa.rifa_id
              and r.tenant_id = movimientos_rifa.tenant_id
              and public.es_miembro(r.tenant_id))
  );
