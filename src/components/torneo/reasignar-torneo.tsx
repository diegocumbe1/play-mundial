"use client";

import { reasignarTorneo } from "@/actions/torneos";
import { ReasignarResponsable } from "@/components/admin/reasignar-responsable";

/** Transfiere un torneo a otro organizador, con todos sus datos. */
export function ReasignarTorneo({
  torneoId,
  tenantActualId,
  tenantActualNombre,
  tenants,
}: {
  torneoId: string;
  tenantActualId: string;
  tenantActualNombre: string;
  tenants: { id: string; nombre: string }[];
}) {
  return (
    <ReasignarResponsable
      entidad="torneo"
      queSeMueve="El torneo y sus equipos, partidos, pagos y gastos"
      nota="El enlace público sigue igual, pero mostrará los datos de cobro del nuevo responsable."
      reasignar={(tenantId) => reasignarTorneo(torneoId, tenantId)}
      tenantActualId={tenantActualId}
      tenantActualNombre={tenantActualNombre}
      tenants={tenants}
    />
  );
}
