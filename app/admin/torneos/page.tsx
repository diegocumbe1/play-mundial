import Link from "next/link";
import { Plus, Trophy } from "lucide-react";

import { getTorneosConResumen } from "@/actions/torneos";
import { getMembership } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { TorneosLista } from "@/components/torneo/torneos-lista";

export const dynamic = "force-dynamic";

export default async function TorneosPage() {
  const membership = await getMembership();
  if (!membership) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">
          Tu usuario no está asociado a ningún organizador. Pídele al administrador que te
          cree el acceso.
        </p>
      </div>
    );
  }

  // La acción valida sesión, tenant y que el producto esté habilitado.
  const res = await getTorneosConResumen();
  if (!res.success) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Trophy className="text-muted-foreground mx-auto mb-3 size-8" />
        <p className="text-muted-foreground text-sm">{res.error}</p>
        <Link href="/admin" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}>
          Volver al panel
        </Link>
      </div>
    );
  }

  const { torneos, resumenes } = res.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Torneos deportivos</h1>
          <p className="text-muted-foreground text-sm">
            Campeonatos, inscripciones y rentabilidad.
          </p>
        </div>
        <Link href="/admin/torneos/nuevo" className={buttonVariants({ size: "lg" })}>
          <Plus className="size-4" /> Nuevo torneo
        </Link>
      </header>

      {torneos.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Trophy className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">Aún no has creado ningún torneo.</p>
          <Link href="/admin/torneos/nuevo" className={buttonVariants({})}>
            <Plus className="size-4" /> Crear mi primer torneo
          </Link>
        </div>
      ) : (
        <TorneosLista torneos={torneos} resumenes={resumenes} />
      )}
    </div>
  );
}
