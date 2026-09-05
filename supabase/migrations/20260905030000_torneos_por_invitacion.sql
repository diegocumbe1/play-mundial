-- =============================================================================
-- Plataforma — Torneos pasa a ser un módulo por invitación
-- =============================================================================
-- Por defecto un organizador solo tiene RIFAS. El módulo de torneos lo habilita
-- el superadmin, uno por uno, desde /superadmin.
--
-- Al aplicar esto NO se le quita el acceso a quien ya tiene torneos creados
-- (perdería su trabajo y sus enlaces públicos) ni al tenant del superadmin.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- Todo tenant queda con la fila explícita (si no existía, nace deshabilitada).
insert into public.tenant_productos (tenant_id, producto, habilitado)
select t.id, 'torneos', false
from public.tenants t
on conflict (tenant_id, producto) do nothing;

-- Se apaga solo donde nadie está usando el módulo todavía.
update public.tenant_productos tp
set habilitado = false
where tp.producto = 'torneos'
  and tp.habilitado
  and not exists (
    select 1 from public.torneos t where t.tenant_id = tp.tenant_id
  )
  and not exists (
    select 1 from public.memberships m
    where m.tenant_id = tp.tenant_id and m.rol = 'superadmin'
  );

-- Rifas, en cambio, sigue siendo el producto base de todo organizador.
insert into public.tenant_productos (tenant_id, producto, habilitado)
select t.id, 'rifas', true
from public.tenants t
on conflict (tenant_id, producto) do nothing;
