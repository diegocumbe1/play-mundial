import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getTorneo } from "@/actions/torneos";
import { esSuperadmin } from "@/lib/auth";
import { TorneoForm } from "@/components/torneo/torneo-form";

export const dynamic = "force-dynamic";

export default async function EditarTorneoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getTorneo(id);
  if (!res.success) notFound();

  const { torneo, premios } = res.data;
  const superadmin = await esSuperadmin();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/admin/torneos/${torneo.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> {torneo.nombre}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Editar torneo</h1>
      <TorneoForm
        torneo={torneo}
        premiosIniciales={premios}
        esSuperadmin={superadmin}
      />
    </div>
  );
}
