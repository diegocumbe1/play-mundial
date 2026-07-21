import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getNextPath(next?: string | string[]) {
  const value = Array.isArray(next) ? next[0] : next;
  return value?.startsWith("/admin") && !value.startsWith("/admin/login")
    ? value
    : "/admin";
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = getNextPath((await searchParams).next);

  // Si ya hay sesión, al panel.
  if (await getUser()) {
    redirect(nextPath);
  }

  return (
    <main className="bg-stadium flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-polla-gold/10 ring-polla-gold/30 flex size-14 items-center justify-center rounded-2xl ring-1">
            <Trophy className="text-polla-gold size-7" />
          </div>
          <h1 className="font-heading text-polla-gold text-3xl tracking-wide">
            Ingreso al panel
          </h1>
          <p className="text-polla-muted text-sm">Panel de administración</p>
        </div>

        <div className="bg-polla-surface ring-polla-line rounded-2xl p-6 ring-1">
          <LoginForm nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}
