import Link from "next/link";

/** Footer con el enlace a términos y privacidad. */
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
        <p>Polla Mundial 2026</p>
      </div>
    </footer>
  );
}
