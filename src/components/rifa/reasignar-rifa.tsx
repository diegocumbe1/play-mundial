"use client";

import { reasignarRifa } from "@/actions/rifas";
import { ReasignarResponsable } from "@/components/admin/reasignar-responsable";

/** Transfiere una rifa a otro organizador. Mueve la rifa y sus boletas. */
export function ReasignarRifa({
  rifaId,
  tenantActualId,
  tenantActualNombre,
  tenants,
}: {
  rifaId: string;
  tenantActualId: string;
  tenantActualNombre: string;
  tenants: { id: string; nombre: string }[];
}) {
  return (
    <ReasignarResponsable
      entidad="rifa"
      queSeMueve="La rifa y todas sus boletas"
      reasignar={(tenantId) => reasignarRifa(rifaId, tenantId)}
      tenantActualId={tenantActualId}
      tenantActualNombre={tenantActualNombre}
      tenants={tenants}
    />
  );
}
