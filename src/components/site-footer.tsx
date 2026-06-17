import Link from "next/link";
import { Lock } from "lucide-react";

/** Footer con el enlace a términos y privacidad, y acceso discreto al admin. */
export function SiteFooter() {
  return (
    <footer className="border-polla-line/70 mt-16 border-t">
      <div className="text-polla-muted mx-auto max-w-3xl space-y-3 px-4 py-8 text-center text-xs">
        <p>
          <Link
            href="/terminos"
            className="hover:text-polla-gold font-medium underline underline-offset-4"
          >
            Términos y condiciones · Política de privacidad
          </Link>
        </p>
        <p className="flex items-center justify-center gap-3">
          <span>Polla Mundial 2026</span>
          <span aria-hidden>·</span>
          <Link
            href="/admin"
            className="hover:text-polla-gold inline-flex items-center gap-1 font-medium"
          >
            <Lock className="size-3" />
            Admin
          </Link>
        </p>
      </div>
    </footer>
  );
}
