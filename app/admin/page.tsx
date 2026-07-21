import Link from "next/link";
import { ArrowRight, Ban, Settings, Ticket, Trophy, Users } from "lucide-react";

import { esSuperadmin, getMembership, getUser } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminHubPage() {
  const [user, membership, superadmin] = await Promise.all([
    getUser(),
    getMembership(),
    esSuperadmin(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel</h1>
          <p className="text-muted-foreground text-sm">
            {user?.email}
            {superadmin ? " · superadmin" : membership ? " · organizador" : ""}
          </p>
        </div>
        <LogoutButton />
      </header>

      {!membership && (
        <div className="border-amber-500/40 bg-amber-500/10 mb-6 rounded-xl border p-4 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400">Tu usuario no tiene rol asignado</p>
          <p className="text-muted-foreground mt-1">
            Aún no está vinculado a ningún organizador. Si eres el superadmin, corre el
            seed: <code className="bg-muted rounded px-1">npm run seed:superadmin -- {user?.email} &quot;password&quot;</code>.
            Si eres organizador, pide al administrador que te dé acceso.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Rifas — módulo principal */}
        {membership && (
          <Modulo
            href="/admin/rifas"
            icon={<Ticket className="size-5" />}
            titulo="Rifas"
            texto="Crea y administra tus rifas: números, pagos, sorteo y enlace público."
          />
        )}

        {/* Superadmin */}
        {superadmin && (
          <>
            <Modulo
              href="/superadmin"
              icon={<Users className="size-5" />}
              titulo="Organizadores y cobros"
              texto="Crea organizadores, confirma pagos y administra la plataforma."
            />
            <Modulo
              href="/superadmin/settings"
              icon={<Settings className="size-5" />}
              titulo="Precios y planes"
              texto="Edita los precios de las rifas y las reglas de la capa gratuita."
            />
          </>
        )}

        {/* Polla Mundial — módulo inhabilitado (archivado) */}
        <ModuloInhabilitado
          superadmin={superadmin}
          icon={<Trophy className="size-5" />}
          titulo="Polla Mundial 2026"
          texto="El Mundial terminó. Este módulo quedó archivado; los datos siguen guardados."
        />
      </div>
    </div>
  );
}

function Modulo({
  href,
  icon,
  titulo,
  texto,
}: {
  href: string;
  icon: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="border-border hover:border-primary/60 hover:bg-muted/40 group flex flex-col gap-2 rounded-2xl border p-5 transition-colors"
    >
      <div className="bg-primary/10 text-primary inline-flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <div className="flex items-center gap-1 font-semibold">
        {titulo}
        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="text-muted-foreground text-sm">{texto}</p>
    </Link>
  );
}

function ModuloInhabilitado({
  superadmin,
  icon,
  titulo,
  texto,
}: {
  superadmin: boolean;
  icon: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="border-border bg-muted/20 relative flex flex-col gap-2 rounded-2xl border border-dashed p-5 opacity-70">
      <span className="text-muted-foreground bg-muted absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
        <Ban className="size-3" /> Inhabilitado
      </span>
      <div className="bg-muted text-muted-foreground inline-flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="font-semibold">{titulo}</p>
      <p className="text-muted-foreground text-sm">{texto}</p>
      {superadmin && (
        <Link href="/admin/mundial" className="text-muted-foreground hover:text-foreground mt-1 text-xs underline">
          Abrir de todos modos (solo superadmin)
        </Link>
      )}
    </div>
  );
}
