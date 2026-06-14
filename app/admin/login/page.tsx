import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Si ya hay sesión, al panel.
  if (await getUser()) {
    redirect("/admin");
  }

  return (
    <main className="bg-stadium flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-polla-gold/10 ring-polla-gold/30 flex size-14 items-center justify-center rounded-2xl ring-1">
            <Trophy className="text-polla-gold size-7" />
          </div>
          <h1 className="font-heading text-polla-gold text-3xl tracking-wide">
            Polla Mundial 2026
          </h1>
          <p className="text-polla-muted text-sm">Panel de administración</p>
        </div>

        <div className="bg-polla-surface ring-polla-line rounded-2xl p-6 ring-1">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
