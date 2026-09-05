"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { setEstadoTenant, type SolicitudCuenta } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { formatFechaCO } from "@/lib/fecha-co";
import { waLink } from "@/lib/whatsapp";

/**
 * Cuentas nuevas esperando aprobación.
 *
 * Una cuenta registrada desde la web nace `pendiente`: puede entrar y preparar
 * rifas en borrador, pero nada se publica hasta que se apruebe aquí. Cada fila
 * trae el WhatsApp (la identidad real del organizador) y cuántas rifas alcanzó
 * a preparar, que es la señal de si va en serio.
 */
export function SolicitudesCuenta({ solicitudes }: { solicitudes: SolicitudCuenta[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decidir(tenantId: string, estado: "activo" | "rechazado", nombre: string) {
    startTransition(async () => {
      const r = await setEstadoTenant(tenantId, estado);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(estado === "activo" ? `${nombre} aprobado` : `${nombre} rechazado`);
      router.refresh();
    });
  }

  if (solicitudes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay cuentas esperando aprobación.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {solicitudes.map(({ tenant, email, rifasBorrador }) => (
        <li key={tenant.id} className="border-border rounded-xl border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{tenant.nombre}</p>
              <p className="text-muted-foreground text-xs">
                {email ?? "sin correo"}
                {tenant.telefono ? ` · ${tenant.telefono}` : " · sin WhatsApp"}
              </p>
              <p className="text-muted-foreground text-xs">
                Se registró el {formatFechaCO(tenant.created_at)} ·{" "}
                {rifasBorrador === 0
                  ? "sin rifas preparadas"
                  : `${rifasBorrador} rifa(s) en borrador`}
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              En revisión
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => decidir(tenant.id, "activo", tenant.nombre)}
            >
              <Check className="size-3.5" /> Aprobar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => decidir(tenant.id, "rechazado", tenant.nombre)}
            >
              <X className="size-3.5" /> Rechazar
            </Button>
            {tenant.telefono && (
              <a
                href={waLink(
                  tenant.telefono,
                  `¡Hola ${tenant.nombre}! Te escribo de la plataforma de rifas por tu cuenta nueva. ¿Me cuentas qué rifa vas a organizar?`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                <MessageCircle className="size-3.5" /> Escribirle antes de decidir
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Encabezado de la sección, con el conteo. */
export function SolicitudesTitulo({ cantidad }: { cantidad: number }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
      <UserCheck className="size-4" /> Cuentas por aprobar
      {cantidad > 0 && (
        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[11px] font-bold">
          {cantidad}
        </span>
      )}
    </p>
  );
}
