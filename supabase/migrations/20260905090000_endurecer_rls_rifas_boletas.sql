-- =============================================================================
-- Seguridad — Cerrar lo que la RLS por sí sola no puede cubrir
-- =============================================================================
-- `rifas_tenant_rw` y `boletas_tenant_rw` son `for all to authenticated`: un
-- miembro puede escribir en esas tablas DIRECTO contra PostgREST con la anon
-- key (que viaja en el navegador) y su sesión, sin pasar por ninguna Server
-- Action. Eso deja tres agujeros reales:
--
--   1. Activarse gratis: bastaba un UPDATE poniendo `estado='activa'` y
--      `cobro_tipo='gratis'` para saltarse pago, cuota y aprobación.
--   2. Contaminar la rifa de otro: `boletas` valida `es_miembro(tenant_id)`,
--      pero nadie comprobaba que el `rifa_id` fuera de ESE tenant.
--   3. Borrar una rifa con ventas y perder el inventario de números.
--
-- La RLS no puede comparar el valor viejo con el nuevo ni restringir columnas,
-- así que la defensa va en triggers. Todo lo que hace la app hoy sigue
-- funcionando: las acciones que activan una rifa ya usan service role.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ¿La petición viene de un usuario final (anon/authenticated) por PostgREST?
-- ---------------------------------------------------------------------------
-- El service role y las conexiones directas (migraciones, psql) no traen ese
-- claim y por lo tanto pasan: la app confía en su propio backend, no en el
-- navegador.
create or replace function public.es_peticion_de_usuario()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  ) in ('anon', 'authenticated');
$$;

-- ---------------------------------------------------------------------------
-- rifas: columnas de cobro y la activación solo desde el backend
-- ---------------------------------------------------------------------------
create or replace function public.rifas_proteger_activacion()
returns trigger
language plpgsql
as $$
begin
  if not public.es_peticion_de_usuario() then
    return new;
  end if;

  -- Publicar una rifa pasa por plan, cuota y aprobación de cuenta.
  if old.estado = 'borrador' and new.estado <> 'borrador' then
    raise exception 'ACTIVACION_NO_PERMITIDA'
      using hint = 'Activa la rifa desde el panel: ahí se aplican plan y cuota.';
  end if;

  -- Datos de facturación e identidad: los escribe el servidor, nunca el cliente.
  if new.cobro_tipo   is distinct from old.cobro_tipo
     or new.cobro_monto  is distinct from old.cobro_monto
     or new.cobro_id     is distinct from old.cobro_id
     or new.activada_at  is distinct from old.activada_at
     or new.tenant_id    is distinct from old.tenant_id
     or new.slug_publico is distinct from old.slug_publico then
    raise exception 'CAMPO_PROTEGIDO'
      using hint = 'Esos datos los administra la plataforma.';
  end if;

  return new;
end;
$$;

drop trigger if exists rifas_proteger_activacion on public.rifas;
create trigger rifas_proteger_activacion
  before update on public.rifas
  for each row execute function public.rifas_proteger_activacion();

-- Nacer activa (saltándose el UPDATE) tampoco: un INSERT solo puede ser borrador.
create or replace function public.rifas_nacer_en_borrador()
returns trigger
language plpgsql
as $$
begin
  if public.es_peticion_de_usuario()
     and (new.estado <> 'borrador' or new.cobro_tipo is not null
          or new.activada_at is not null) then
    raise exception 'ACTIVACION_NO_PERMITIDA'
      using hint = 'Una rifa nueva nace en borrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists rifas_nacer_en_borrador on public.rifas;
create trigger rifas_nacer_en_borrador
  before insert on public.rifas
  for each row execute function public.rifas_nacer_en_borrador();

-- ---------------------------------------------------------------------------
-- rifas: no borrar lo que ya tiene ventas
-- ---------------------------------------------------------------------------
create or replace function public.rifas_proteger_borrado()
returns trigger
language plpgsql
as $$
begin
  if not public.es_peticion_de_usuario() then
    return old;
  end if;

  if old.estado <> 'borrador' then
    raise exception 'RIFA_NO_BORRABLE'
      using hint = 'Una rifa publicada se cancela, no se borra.';
  end if;

  if exists (select 1 from public.boletas b where b.rifa_id = old.id) then
    raise exception 'RIFA_CON_VENTAS'
      using hint = 'Tiene números registrados: libéralos primero.';
  end if;

  return old;
end;
$$;

drop trigger if exists rifas_proteger_borrado on public.rifas;
create trigger rifas_proteger_borrado
  before delete on public.rifas
  for each row execute function public.rifas_proteger_borrado();

-- ---------------------------------------------------------------------------
-- boletas: el número tiene que pertenecer a una rifa del MISMO tenant
-- ---------------------------------------------------------------------------
-- La policy solo miraba `boletas.tenant_id`. Con eso, un miembro podía insertar
-- números en la rifa de otro organizador poniendo su propio tenant_id.
create or replace function public.boletas_coherencia_tenant()
returns trigger
language plpgsql
as $$
declare
  v_rifa_tenant uuid;
  v_inicio      integer;
  v_cantidad    integer;
begin
  select r.tenant_id, coalesce(r.numero_inicial, 0), r.cantidad_numeros
    into v_rifa_tenant, v_inicio, v_cantidad
  from public.rifas r
  where r.id = new.rifa_id;

  if v_rifa_tenant is null then
    raise exception 'RIFA_INEXISTENTE';
  end if;

  if new.tenant_id is distinct from v_rifa_tenant then
    raise exception 'TENANT_NO_COINCIDE'
      using hint = 'El número no pertenece a una rifa de este organizador.';
  end if;

  -- Fuera del rango de la rifa no existe ningún número que vender.
  if new.numero < v_inicio or new.numero > (v_inicio + v_cantidad - 1) then
    raise exception 'NUMERO_FUERA_DE_RANGO'
      using hint = 'Ese número no existe en esta rifa.';
  end if;

  return new;
end;
$$;

drop trigger if exists boletas_coherencia_tenant on public.boletas;
create trigger boletas_coherencia_tenant
  before insert or update on public.boletas
  for each row execute function public.boletas_coherencia_tenant();
