import Link from "next/link";
import { ArrowRight, Check, MessageCircle, Share2, Sparkles, Ticket, Trophy, Wallet } from "lucide-react";

import { MarcaSimbolo } from "@/components/marca-simbolo";
import { buttonVariants } from "@/components/ui/button";
import { MARCA } from "@/lib/marca";
import { getPlataformaConfig, getPlataformaPagoConfig } from "@/lib/tenant-config";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";

/**
 * Portada pública de la plataforma (cuando la polla está inactiva).
 *
 * Rifas es autoservicio: el botón principal lleva al registro. Torneos es por
 * invitación (ver `habilitarProductosIniciales`): una cuenta nueva no lo tiene,
 * así que su botón pide acceso en vez de mandar a un formulario que la rechaza.
 */
export async function PlataformaLanding() {
  const [config, pago] = await Promise.all([getPlataformaConfig(), getPlataformaPagoConfig()]);

  const totalGratis = config.free_rifas_total;
  const notaGratis =
    totalGratis === 1
      ? "Tu primera rifa es gratis."
      : totalGratis > 1
        ? `Tus primeras ${totalGratis} rifas son gratis.`
        : null;

  const accesoTorneos = pago?.whatsapp
    ? waLink(pago.whatsapp, `Hola, quiero organizar un torneo en ${MARCA.nombre}.`)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-5">
        <span className="inline-flex min-w-0 items-center gap-2 font-bold">
          <MarcaSimbolo className="text-primary size-7 shrink-0" />
          <span className="truncate">{MARCA.nombre}</span>
        </span>
        <nav className="flex shrink-0 items-center gap-2">
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
        <section className="py-10 text-center sm:py-16">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            {MARCA.tagline}
          </p>
          <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-bold text-balance sm:text-5xl">
            Organiza tu rifa o tu torneo y cobra tú
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-balance">
            Comparte un enlace por WhatsApp, lleva el control de quién pagó y deja que
            todos sigan en vivo cómo va. Sin comisiones por venta.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/admin/login" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
              Crear mi rifa <ArrowRight className="size-4" />
            </Link>
            <a
              href="#torneos"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
            >
              Quiero organizar un torneo
            </a>
          </div>
          {notaGratis && <p className="text-muted-foreground mt-3 text-xs">{notaGratis}</p>}
        </section>

        {/* Los dos productos */}
        <section className="grid gap-4 pb-14 sm:grid-cols-2" aria-label="Qué puedes organizar">
          <Producto
            icon={<Ticket className="size-5" />}
            titulo="Rifas"
            resumen="Vende tus números sin planillas ni mensajes perdidos."
            puntos={[
              "Enlace público con los números libres en vivo; nadie ve quién no ha pagado",
              "Sorteo propio o atado a una lotería (Boyacá, Manizales…)",
              "Pagos directo a tu cuenta, Bre-B o QR",
              "Flyer para redes que se actualiza con los números vendidos",
            ]}
          >
            <Link href="/admin/login" className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}>
              Crear mi rifa <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/precios"
              className="text-muted-foreground hover:text-foreground mt-3 block text-center text-sm underline underline-offset-4"
            >
              Ver precios de rifas
            </Link>
          </Producto>

          <Producto
            id="torneos"
            icon={<Trophy className="size-5" />}
            titulo="Torneos"
            resumen="De las inscripciones al podio, con las cuentas claras."
            puntos={[
              "Inscripción de equipos por enlace, sin crear cuenta",
              "Fixture, grupos, llaves y tabla de posiciones",
              "Marcadores en vivo en la página pública del torneo",
              "Abonos, gastos y punto de equilibrio para saber cuánto te queda",
            ]}
          >
            {accesoTorneos && (
              <a
                href={accesoTorneos}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full")}
              >
                <MessageCircle className="size-4" /> Pedir acceso por WhatsApp
              </a>
            )}
            <p className="text-muted-foreground mt-3 text-center text-sm">
              Por ahora, solo por invitación. Lo activamos en tu cuenta y tú lo gestionas.
            </p>
          </Producto>
        </section>

        {/* Cómo funciona */}
        <section className="pb-16">
          <h2 className="mb-4 text-center text-xl font-bold">Así de simple</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Paso
              icon={<Sparkles className="size-5" />}
              titulo="1. Créalo"
              texto="Define los números y premios de tu rifa, o las categorías y reglas de tu torneo."
            />
            <Paso
              icon={<Share2 className="size-5" />}
              titulo="2. Comparte el enlace"
              texto="Lo mandas por WhatsApp y cada quien ve lo que necesita, sin instalar nada."
            />
            <Paso
              icon={<Wallet className="size-5" />}
              titulo="3. Cobra y lleva el control"
              texto="El dinero llega directo a ti. Marcas quién pagó y tienes todo en un solo panel."
            />
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground border-border border-t px-4 py-6 text-center text-xs">
        <Link href="/terminos" className="hover:text-foreground">Términos y política de datos</Link>
      </footer>
    </div>
  );
}

function Producto({
  id,
  icon,
  titulo,
  resumen,
  puntos,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  titulo: string;
  resumen: string;
  puntos: string[];
  children: React.ReactNode;
}) {
  return (
    <article id={id} className="border-border flex scroll-mt-4 flex-col rounded-2xl border p-5 sm:p-6">
      <div className="bg-primary/10 text-primary mb-3 inline-flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{titulo}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{resumen}</p>
      <ul className="mt-4 mb-6 space-y-2 text-sm">
        {puntos.map((p) => (
          <li key={p} className="flex gap-2">
            <Check className="text-primary mt-0.5 size-4 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">{children}</div>
    </article>
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
