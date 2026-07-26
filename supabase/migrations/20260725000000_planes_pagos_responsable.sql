-- =============================================================================
-- Plataforma: rifas hasta 1000, pagos del backoffice y responsable de venta
-- =============================================================================
-- Idempotente.
-- =============================================================================

alter table public.plataforma_config
  add column if not exists precio_rifa_1000 integer not null default 0;

create table if not exists public.plataforma_pago_config (
  id          boolean primary key default true check (id),
  nequi_llave text,
  llave       text,
  titular     text,
  qr_url      text,
  whatsapp    text,
  mensaje_qr  text,
  updated_at  timestamptz not null default now()
);

insert into public.plataforma_pago_config (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists plataforma_pago_config_set_updated_at on public.plataforma_pago_config;
create trigger plataforma_pago_config_set_updated_at
  before update on public.plataforma_pago_config
  for each row execute function public.set_updated_at();

alter table public.plataforma_pago_config enable row level security;

drop policy if exists "plataforma_pago_select_public" on public.plataforma_pago_config;
create policy "plataforma_pago_select_public" on public.plataforma_pago_config for select
  to anon, authenticated using (true);

drop policy if exists "plataforma_pago_super_write" on public.plataforma_pago_config;
create policy "plataforma_pago_super_write" on public.plataforma_pago_config for all
  to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

alter table public.boletas
  add column if not exists responsable_venta text;
