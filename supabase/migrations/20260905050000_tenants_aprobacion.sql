-- =============================================================================
-- Plataforma — Cuentas nuevas: aprobación del superadmin + WhatsApp único
-- =============================================================================
-- Una cuenta creada desde el registro público nace `pendiente`: puede entrar y
-- preparar su rifa en BORRADOR (nada de eso es visible para nadie), pero no
-- puede activarla hasta que el superadmin la apruebe. Así el organizador no se
-- topa con un muro en el primer minuto y el superadmin ve qué se va a publicar
-- antes de decidir.
--
-- `telefono` es la identidad real del organizador: un celular cuesta duplicarlo,
-- un correo no. Es único entre tenants, así que no se puede reiniciar la cuota
-- gratuita creando cuentas nuevas con el mismo número.
-- Idempotente / re-ejecutable.
-- =============================================================================

-- `ALTER TYPE ... ADD VALUE` no puede correr dentro de un bloque de transacción,
-- por eso va suelto (el script de migración usa autocommit).
alter type public.estado_tenant add value if not exists 'pendiente';
alter type public.estado_tenant add value if not exists 'rechazado';

alter table public.tenants
  add column if not exists telefono text,
  add column if not exists aprobado_at timestamptz,
  add column if not exists nota_admin text;

-- Un WhatsApp = un organizador. Se guarda ya normalizado (solo dígitos).
create unique index if not exists tenants_telefono_uniq
  on public.tenants (telefono)
  where telefono is not null;

-- Los organizadores que ya venían trabajando quedan aprobados: esto no puede
-- apagarle la cuenta a nadie que ya esté vendiendo.
update public.tenants
set aprobado_at = coalesce(aprobado_at, created_at)
where estado = 'activo' and aprobado_at is null;
