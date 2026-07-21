import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Share2, Ticket, Wallet } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/** Portada pública de la plataforma de rifas (cuando la polla está inactiva). */
export function RifasLanding() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5">
        <span className="inline-flex items-center gap-2 font-bold">
          <Ticket className="text-primary size-5" /> Rifas
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/precios" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Precios
          </Link>
          <Link href="/admin/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ingresar
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4">
        {/* Hero */}
        <section className="py-14 text-center sm:py-20">
          <p className="text-primary text-sm font-semibold uppercase tracking-wide">Tu rifa, en línea</p>
          <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-bold text-balance sm:text-5xl">
            Organiza tu rifa y cobra tú, sin comisiones por venta
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-balance">
            Crea tu rifa en minutos, comparte un enlace que se actualiza solo y lleva
            el control de quién pagó. Con sorteo propio o atada a una lotería.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/admin/login" className={buttonVariants({ size: "lg" })}>
              Crear mi rifa <ArrowRight className="size-4" />
            </Link>
            <Link href="/precios" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Ver precios
            </Link>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Empieza gratis · 1 rifa al mes sin costo.
          </p>
        </section>

        {/* Cómo funciona */}
        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          <Paso
            icon={<Ticket className="size-5" />}
            titulo="1. Crea la rifa"
            texto="Define números, precio y premios. Elige sorteo propio o por lotería (Boyacá, Manizales…)."
          />
          <Paso
            icon={<Share2 className="size-5" />}
            titulo="2. Comparte el enlace"
            texto="Un enlace público muestra en vivo los números libres. Nadie ve quién no ha pagado."
          />
          <Paso
            icon={<Wallet className="size-5" />}
            titulo="3. Cobra y sortea"
            texto="Recibe pagos a tu Nequi, marca quién pagó y resuelve el ganador automáticamente."
          />
        </section>

        <section className="border-border mb-16 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
          <ImageIcon className="text-primary size-6" />
          <p className="max-w-md text-balance font-medium">
            Exporta un flyer para redes que se actualiza con los números vendidos.
          </p>
          <Link href="/precios" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Conocer los planes
          </Link>
        </section>
      </main>

      <footer className="text-muted-foreground border-border border-t px-4 py-6 text-center text-xs">
        <Link href="/terminos" className="hover:text-foreground">Términos y política de datos</Link>
      </footer>
    </div>
  );
}

function Paso({ icon, titulo, texto }: { icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="border-border rounded-2xl border p-5">
      <div className="bg-primary/10 text-primary mb-3 inline-flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="font-semibold">{titulo}</p>
      <p className="text-muted-foreground mt-1 text-sm">{texto}</p>
    </div>
  );
}
