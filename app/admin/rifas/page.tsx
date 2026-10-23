import Link from "next/link";
import { Plus, Ticket } from "lucide-react";

import { getRifas } from "@/actions/rifas";
import { getMembership } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { EstadoRifaBadge } from "@/components/rifa/estado-rifa-badge";
import { AccionesRifa } from "@/components/rifa/acciones-rifa";

export const dynamic = "force-dynamic";

export default async function RifasPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string | string[] }>;
}) {
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

  const [res, params] = await Promise.all([getRifas(), searchParams]);
  const todas = res.success ? res.data : [];
  const verArchivadas = (Array.isArray(params.ver) ? params.ver[0] : params.ver) === "archivadas";
  const archivadas = todas.filter((r) => r.archivada_at);
  const rifas = verArchivadas ? archivadas : todas.filter((r) => !r.archivada_at);

  const pestana = (activa: boolean) =>
    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
    (activa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted");

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

      {/* Archivadas solo aparece cuando hay algo archivado (o ya estás ahí). */}
      {(archivadas.length > 0 || verArchivadas) && (
        <nav className="border-border mb-4 inline-flex gap-1 rounded-lg border p-1">
          <Link href="/admin/rifas" className={pestana(!verArchivadas)}>
            Mis rifas
          </Link>
          <Link href="/admin/rifas?ver=archivadas" className={pestana(verArchivadas)}>
            Archivadas ({archivadas.length})
          </Link>
        </nav>
      )}

      {verArchivadas && rifas.length > 0 && (
        <p className="text-muted-foreground mb-3 text-xs">
          Estas rifas no se ven en el enlace público. Restáuralas para que vuelvan como
          estaban, o bórralas para siempre.
        </p>
      )}

      {verArchivadas && rifas.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed p-12 text-center text-sm">
          No tienes rifas archivadas.
        </p>
      ) : rifas.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Ticket className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            {archivadas.length > 0
              ? "No tienes rifas en tu lista: las demás están archivadas."
              : "Aún no has creado ninguna rifa."}
          </p>
          <Link href="/admin/rifas/nueva" className={buttonVariants({})}>
            <Plus className="size-4" /> Crear mi primera rifa
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rifas.map((r) => (
            <li
              key={r.id}
              className={`border-border flex items-center gap-1 rounded-xl border pr-2 ${
                verArchivadas ? "opacity-80" : ""
              }`}
            >
              <Link
                href={`/admin/rifas/${r.id}`}
                className="tap-card hover:bg-muted/50 flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl p-4 transition-colors"
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
              <AccionesRifa rifa={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
