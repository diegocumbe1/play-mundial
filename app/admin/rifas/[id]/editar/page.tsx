import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getRifa } from "@/actions/rifas";
import { getMembership } from "@/lib/auth";
import { RifaForm } from "@/components/rifa/rifa-form";

export const dynamic = "force-dynamic";

export default async function EditarRifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getMembership();
  if (!membership) {
    return <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">Sin acceso.</div>;
  }

  const res = await getRifa(id);
  if (!res.success) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/admin/rifas/${id}`} className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Volver a la rifa
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Editar rifa</h1>
      <RifaForm rifa={res.data.rifa} premiosIniciales={res.data.premios} />
    </div>
  );
}
