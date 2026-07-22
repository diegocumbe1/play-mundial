import Link from "next/link";
import { Plus, Ticket } from "lucide-react";

import { getRifas } from "@/actions/rifas";
import { getMembership } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { EstadoRifaBadge } from "@/components/rifa/estado-rifa-badge";

export const dynamic = "force-dynamic";

export default async function RifasPage() {
  const membership = await getMembership();
  if (!membership) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">
          Tu usuario no está asociado a ningún organizador. Pídele al administrador
          que te cree el acceso.
        </p>
      </div>
    );
  }

  const res = await getRifas();
  const rifas = res.success ? res.data : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis rifas</h1>
          <p className="text-muted-foreground text-sm">Crea y administra tus rifas.</p>
        </div>
        <Link href="/admin/rifas/nueva" className={buttonVariants({ size: "lg" })}>
          <Plus className="size-4" /> Nueva rifa
        </Link>
      </header>

      {rifas.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Ticket className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">Aún no has creado ninguna rifa.</p>
          <Link href="/admin/rifas/nueva" className={buttonVariants({})}>
            <Plus className="size-4" /> Crear mi primera rifa
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rifas.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/rifas/${r.id}`}
                className="tap-card border-border hover:bg-muted/50 flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.cantidad_numeros} números · {formatCOP(r.precio_boleta)} c/u
                    {r.tipo === "loteria" && r.loteria ? ` · ${r.loteria}` : ""}
                  </p>
                  {(() => {
                    const f = formatFechaCO(
                      r.tipo === "loteria" ? (r.fecha_loteria ?? r.fecha_sorteo) : r.fecha_sorteo,
                    );
                    return f ? (
                      <p className="text-muted-foreground text-xs">Juega el {f}</p>
                    ) : null;
                  })()}
                </div>
                <EstadoRifaBadge estado={r.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
