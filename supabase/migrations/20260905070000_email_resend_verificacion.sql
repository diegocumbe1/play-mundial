-- =============================================================================
-- Plataforma — Correo saliente (Resend) + verificación de email para vender
-- =============================================================================
-- 1) `plataforma_email_config`: credenciales del correo, editables por el
--    superadmin sin redeploy (igual que en Lynko).
--
--    NO va en `plataforma_config`: esa tabla tiene una policy de lectura
--    `to anon using (true)` porque la usa la página pública de precios. Una API
--    key ahí sería pública para cualquiera que tenga la anon key —que viaja en
--    el navegador—. Por eso esta tabla queda con RLS activo y SIN políticas:
--    solo el service role (que las salta) puede leerla o escribirla, y todo
--    acceso pasa por Server Actions.
--
-- 2) Regla global: no se puede tocar el estado de un número si el organizador
--    no tiene el correo verificado. Se implementa como TRIGGER, no solo en las
--    Server Actions: la policy `boletas_tenant_rw ... for all to authenticated`
--    permite escribir directo contra PostgREST con la anon key, así que un
--    guard únicamente en el código de la app sería evadible desde la API.
--    El trigger corre también para el service role (las reservas públicas).
--
-- Compatibilidad: hoy todos los usuarios se crearon con `email_confirm: true`,
-- así que todos quedan verificados y ninguna rifa en curso se ve afectada.
-- Idempotente / re-ejecutable.
-- =============================================================================

create table if not exists public.plataforma_email_config (
  id             boolean primary key default true check (id),  -- fuerza 1 fila
  resend_api_key text,
  from_email     text,
  from_nombre    text,
  reply_to       text,
  activo         boolean not null default false,
  updated_at     timestamptz not null default now()
);

insert into public.plataforma_email_config (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists plataforma_email_config_set_updated_at
  on public.plataforma_email_config;
create trigger plataforma_email_config_set_updated_at
  before update on public.plataforma_email_config
  for each row execute function public.set_updated_at();

-- RLS sin políticas = nadie entra salvo el service role.
alter table public.plataforma_email_config enable row level security;
drop policy if exists "email_config_select_public" on public.plataforma_email_config;
drop policy if exists "email_config_super_write" on public.plataforma_email_config;

-- ---------------------------------------------------------------------------
-- ¿El organizador tiene el correo verificado?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque `auth.users` no es legible por los roles normales.
create or replace function public.tenant_email_verificado(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.tenant_email_verificado(uuid) from public;
grant execute on function public.tenant_email_verificado(uuid) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Trigger: sin correo verificado no se registra ni se mueve ningún número
-- ---------------------------------------------------------------------------
create or replace function public.boletas_exigir_email_verificado()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid;
begin
  v_tenant := coalesce(new.tenant_id, old.tenant_id);
  if v_tenant is null then
    return coalesce(new, old);
  end if;

  if not public.tenant_email_verificado(v_tenant) then
    -- El código va en el mensaje: la app lo detecta y muestra el modal de
    -- "verifica tu correo" en vez de un error técnico.
    raise exception 'EMAIL_VERIFICATION_REQUIRED'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists boletas_email_verificado on public.boletas;
create trigger boletas_email_verificado
  before insert or update or delete on public.boletas
  for each row execute function public.boletas_exigir_email_verificado();
