-- =============================================================================
-- Planes — FREE a prueba de fugas, cobro por porcentaje y PRO con tope
-- =============================================================================
-- 1) FREE: el consumo dejaba de contarse si se borraba la rifa (el contador
--    eran las propias filas de `rifas`, y la RLS del tenant permite DELETE
--    directo contra PostgREST). Ahora se registra en `tenant_free_usos`, que es
--    append-only: borrar la rifa ya no devuelve el cupo.
--
-- 2) Cobro por rifa: 1% del recaudo proyectado (números × precio), acotado a un
--    mínimo y un máximo. Cobrar "una boleta" no era monótono — una rifa de 500×
--    $20.000 recauda el doble que una de 100×$50.000 y pagaba menos de la mitad.
--
-- 3) PRO: hasta N activaciones por ciclo. Antes la suscripción activaba sin
--    límite mientras estuviera vigente.
--
-- 4) Concurrencia: `consumir_free` y `consumir_pro` deciden y registran en UNA
--    sola sentencia con lock por tenant, así dos activaciones simultáneas no
--    pueden gastar el mismo último cupo.
--
-- Las rifas ya activadas no se tocan: conservan su `cobro_tipo` y su cobro.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
alter table public.plataforma_config
  add column if not exists cobro_rifa_pct numeric(5,2) not null default 1.00,
  add column if not exists pro_max_rifas_ciclo integer not null default 10;

do $$
begin
  -- El modo pasa a admitir 'porcentaje' (la regla nueva).
  alter table public.plataforma_config
    drop constraint if exists plataforma_config_cobro_rifa_modo_check;
  alter table public.plataforma_config
    add constraint plataforma_config_cobro_rifa_modo_check
    check (cobro_rifa_modo in ('porcentaje', 'boleta', 'escalones'));
end $$;

-- Valores de negocio acordados. Solo se tocan si siguen en su default (0),
-- para no pisar una configuración que el superadmin ya haya ajustado.
update public.plataforma_config
set cobro_rifa_modo = 'porcentaje',
    cobro_rifa_min  = case when cobro_rifa_min  = 0 then 8000  else cobro_rifa_min  end,
    cobro_rifa_max  = case when cobro_rifa_max  = 0 then 29900 else cobro_rifa_max  end
where cobro_rifa_modo = 'boleta';

-- ---------------------------------------------------------------------------
-- Snapshot del cobro en la rifa
-- ---------------------------------------------------------------------------
-- `cobros.monto` ya congelaba el precio; esto deja la trazabilidad a la vista
-- sin tener que cruzar tablas.
alter table public.rifas
  add column if not exists cobro_monto integer,
  add column if not exists cobro_id uuid references public.cobros (id) on delete set null;

-- Un solo cobro pendiente por rifa: antes, tres clics en "Activar" dejaban tres.
create unique index if not exists cobros_pendiente_por_rifa
  on public.cobros (rifa_id)
  where estado = 'pendiente' and rifa_id is not null;

-- ---------------------------------------------------------------------------
-- FREE: registro append-only de cupos consumidos
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_free_usos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  -- Sin FK a rifas: si la rifa se borra, el cupo consumido NO debe desaparecer.
  rifa_id      uuid,
  producto     text not null default 'rifas',
  consumido_at timestamptz not null default now(),
  unique (tenant_id, rifa_id)
);

create index if not exists tenant_free_usos_tenant_idx
  on public.tenant_free_usos (tenant_id, consumido_at);

alter table public.tenant_free_usos enable row level security;
drop policy if exists "free_usos_select_miembro" on public.tenant_free_usos;
create policy "free_usos_select_miembro" on public.tenant_free_usos for select
  to authenticated using (public.es_miembro(tenant_id));
-- Escribir solo por las funciones de abajo (service role): nadie más.

-- Siembra: las rifas que ya se activaron gratis conservan su consumo.
insert into public.tenant_free_usos (tenant_id, rifa_id, producto, consumido_at)
select r.tenant_id, r.id, 'rifas', coalesce(r.activada_at, r.created_at)
from public.rifas r
where r.cobro_tipo = 'gratis'
on conflict (tenant_id, rifa_id) do nothing;

-- ---------------------------------------------------------------------------
-- Consumo atómico del cupo gratuito
-- ---------------------------------------------------------------------------
-- Devuelve true si la rifa quedó cubierta por la capa gratuita. El lock por
-- tenant evita que dos activaciones simultáneas gasten el mismo último cupo.
create or replace function public.consumir_free(
  p_tenant    uuid,
  p_rifa      uuid,
  p_producto  text,
  p_max_total integer,
  p_max_mes   integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_mes   integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  -- Reintento de la misma rifa: ya tenía su cupo, no se cobra dos veces.
  if exists (
    select 1 from public.tenant_free_usos
    where tenant_id = p_tenant and rifa_id = p_rifa
  ) then
    return true;
  end if;

  select count(*) into v_total
  from public.tenant_free_usos
  where tenant_id = p_tenant and producto = p_producto;

  select count(*) into v_mes
  from public.tenant_free_usos
  where tenant_id = p_tenant
    and producto = p_producto
    and date_trunc('month', consumido_at) = date_trunc('month', now());

  if v_total >= p_max_total or v_mes >= p_max_mes then
    return false;
  end if;

  insert into public.tenant_free_usos (tenant_id, rifa_id, producto)
  values (p_tenant, p_rifa, p_producto);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consumo atómico de un cupo PRO del ciclo
-- ---------------------------------------------------------------------------
-- El ciclo se define por la ventana [p_desde, ahora]: el llamador la calcula a
-- partir de `suscripcion_vence_at`. Cuenta activaciones ya hechas con plan
-- `suscripcion` para no depender de otra tabla.
create or replace function public.consumir_pro(
  p_tenant uuid,
  p_rifa   uuid,
  p_max    integer,
  p_desde  timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usadas integer;
begin
  perform pg_advisory_xact_lock(hashtext('pro:' || p_tenant::text));

  -- La misma rifa reintentando no consume un cupo nuevo.
  if exists (
    select 1 from public.rifas
    where id = p_rifa and cobro_tipo = 'suscripcion'
  ) then
    return true;
  end if;

  select count(*) into v_usadas
  from public.rifas
  where tenant_id = p_tenant
    and cobro_tipo = 'suscripcion'
    and activada_at is not null
    and activada_at >= p_desde;

  return v_usadas < p_max;
end;
$$;

revoke all on function public.consumir_free(uuid, uuid, text, integer, integer) from public;
revoke all on function public.consumir_pro(uuid, uuid, integer, timestamptz) from public;
grant execute on function public.consumir_free(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.consumir_pro(uuid, uuid, integer, timestamptz) to service_role;
