-- =============================================================================
-- Cuentas de cobro — documento independiente, reutilizable como plantilla
-- =============================================================================
-- El superadmin crea una cuenta de cobro (opcionalmente vinculada a un torneo y
-- a su organizador) y comparte un enlace único `/cobro/<clave>`. El cliente
-- completa SUS datos (quién recibe, NIT o cédula, contacto) una sola vez; luego
-- queda bloqueada para él y solo el superadmin la edita.
--
-- Los datos de quien cobra (emisor) y de pago se COPIAN a cada cuenta al crearla:
-- un documento ya enviado no cambia si luego se edita la configuración.
--
-- Todo el acceso es por servicio (service role): RLS activa y SIN políticas, así
-- que ni `anon` ni `authenticated` leen estas tablas directamente.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- Datos por defecto de quien cobra y del pago (una sola fila).
create table if not exists public.cuentas_cobro_config (
  id                boolean primary key default true check (id),
  emisor_nombre     text,
  emisor_documento  text,
  emisor_marca      text not null default 'Lynko · Play Mundial',
  emisor_whatsapp   text,
  pago_llave        text,   -- llave Bre-B
  pago_banco        text,
  pago_titular      text,
  nota              text,   -- nota tributaria u otra, opcional
  updated_at        timestamptz not null default now()
);

insert into public.cuentas_cobro_config (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists cuentas_cobro_config_set_updated_at on public.cuentas_cobro_config;
create trigger cuentas_cobro_config_set_updated_at
  before update on public.cuentas_cobro_config
  for each row execute function public.set_updated_at();

create sequence if not exists public.cuentas_cobro_numero_seq;

create table if not exists public.cuentas_cobro (
  id             uuid primary key default gen_random_uuid(),
  -- Enlace secreto del cliente. Largo e imposible de adivinar.
  clave          text not null unique,
  numero         integer not null default nextval('public.cuentas_cobro_numero_seq'),

  -- Vínculo opcional con el torneo y su organizador.
  torneo_id      uuid references public.torneos (id) on delete set null,
  tenant_id      uuid references public.tenants (id) on delete set null,

  fecha          date not null,
  fecha_limite   date,

  -- Cliente: lo pone el superadmin al crearla.
  cliente_nombre text not null,
  cliente_ciudad text,

  concepto         text not null,
  concepto_detalle text,
  items            text[] not null default '{}',
  valor            integer not null check (valor >= 0),
  nota             text,

  -- Lo que completa el cliente (el superadmin también puede editarlo).
  recibe_nombre      text,
  cliente_documento  text,
  contacto_nombre    text,
  contacto_whatsapp  text,

  -- Quien cobra y cómo pagar: copia de la configuración al crear.
  emisor_nombre     text not null,
  emisor_documento  text,
  emisor_marca      text not null default 'Lynko · Play Mundial',
  emisor_whatsapp   text,
  pago_llave        text,
  pago_banco        text,
  pago_titular      text,

  -- enviada: el cliente puede completar · datos_completos: bloqueada para él
  estado     text not null default 'enviada'
               check (estado in ('enviada', 'datos_completos', 'pagada', 'anulada')),
  datos_completados_at timestamptz,
  pagada_at            timestamptz,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cuentas_cobro_torneo_idx on public.cuentas_cobro (torneo_id);
create index if not exists cuentas_cobro_tenant_idx on public.cuentas_cobro (tenant_id);
create index if not exists cuentas_cobro_estado_idx on public.cuentas_cobro (estado);

drop trigger if exists cuentas_cobro_set_updated_at on public.cuentas_cobro;
create trigger cuentas_cobro_set_updated_at
  before update on public.cuentas_cobro
  for each row execute function public.set_updated_at();

alter table public.cuentas_cobro_config enable row level security;
alter table public.cuentas_cobro enable row level security;
