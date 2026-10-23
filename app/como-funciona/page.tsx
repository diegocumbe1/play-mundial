import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMembership } from "@/lib/auth";
import { getIdioma } from "@/lib/idioma-server";
import { MARCA } from "@/lib/marca";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cómo funciona el sorteo",
  description:
    "Cómo se sortea una rifa en la plataforma: con lotería (2, 3 o 4 cifras) o con sorteo propio en vivo. Guía para organizadores y compradores, también para rifas de 10.000 números.",
};

/**
 * Guía pública del sorteo. Explica las dos mecánicas que existen hoy en el
 * producto (lotería y sorteo propio) en palabras del comprador y del
 * organizador, con el caso de las rifas grandes (10.000 números) aparte porque
 * es donde más dudas aparecen. Si cambia la lógica de `resolverGanadores` o de
 * `sortearRifaInterna`, este texto tiene que acompañarla.
 */
function Seccion({
  id,
  titulo,
  children,
}: {
  id?: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="font-heading mb-3 text-2xl tracking-wide text-white">
        {titulo}
      </h2>
      <div className="text-polla-muted space-y-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Pasos({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="bg-polla-gold/15 text-polla-gold flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Ejemplo({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-polla-line/70 rounded-xl border bg-white/[0.03] p-4 text-sm">
      {children}
    </div>
  );
}

export default async function ComoFuncionaPage() {
  const [idioma, membership] = await Promise.all([
    getIdioma(),
    getMembership(),
  ]);

  return (
    <>
      <SiteHeader idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
          Cómo funciona el sorteo
        </h1>
        <p className="text-polla-muted mt-3 text-sm">
          En {MARCA.nombre} cada rifa se sortea de una de dos formas:{" "}
          <strong>con la lotería</strong> o con un{" "}
          <strong>sorteo propio en vivo</strong>. El organizador la elige al
          crear la rifa y queda escrita en la página pública antes de que
          compres.
        </p>

        <nav className="mt-6 grid gap-2 sm:grid-cols-2">
          {[
            ["#loteria", "🎟️ Con lotería"],
            ["#sorteo-propio", "🎱 Sorteo propio en vivo"],
            ["#rifas-grandes", "🏍️ Rifas de 10.000 números"],
            ["#compradores", "🙋 Si vas a comprar"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="border-polla-line/70 hover:border-polla-gold rounded-xl border px-4 py-3 text-sm font-medium text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <Seccion id="loteria" titulo="🎟️ Con lotería">
          <p>
            El ganador lo define el{" "}
            <strong>resultado oficial de una lotería</strong> (por ejemplo, la
            Lotería de Boyacá) en la fecha anunciada. Nadie de la plataforma ni
            el organizador escoge el número: sale de un sorteo público y
            externo.
          </p>
          <p>
            Se juega con las cifras del premio mayor, según el tamaño de la
            rifa:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>2 cifras</strong>: rifas de 100 números (00–99).
            </li>
            <li>
              <strong>3 cifras</strong>: rifas de 1.000 números (000–999).
            </li>
            <li>
              <strong>4 cifras</strong>: rifas de 10.000 números (0000–9999).
            </li>
          </ul>
          <p>
            El organizador indica si gana con las <strong>últimas</strong>{" "}
            cifras, las <strong>primeras</strong> o <strong>ambas</strong> (dos
            premios). Cuando sale el resultado, lo ingresa en su panel y la
            plataforma busca automáticamente quién tiene ese número y lo
            publica.
          </p>
          <Ejemplo>
            Resultado de la lotería:{" "}
            <strong className="text-white">4521</strong>.
            <br />
            Rifa de 100 números con últimas 2 cifras → gana el{" "}
            <strong className="text-white">21</strong>.
            <br />
            Rifa de 10.000 números con 4 cifras → gana el{" "}
            <strong className="text-white">4521</strong>.
          </Ejemplo>
          <p>
            <strong className="text-white">
              ¿Y si ese número no se vendió?
            </strong>{" "}
            Con lotería puede pasar: el número ganador existe aunque nadie lo
            haya comprado. La plataforma lo marca como &quot;sin vender&quot; y
            no inventa un ganador. Por eso el organizador debe publicar{" "}
            <strong>desde el principio</strong> qué hace en ese caso (por
            ejemplo, se juega de nuevo con la lotería de la semana siguiente).
            Si la rifa no lo dice, pregúntale antes de comprar.
          </p>
        </Seccion>

        <Seccion id="sorteo-propio" titulo="🎱 Sorteo propio en vivo">
          <p>
            Las balotas salen de un{" "}
            <strong>generador aleatorio seguro del servidor</strong>, y solo
            entre los números que juegan (normalmente, los{" "}
            <strong>pagados</strong>). Por eso{" "}
            <strong>siempre hay un ganador</strong> entre quienes compraron.
          </p>
          <Pasos
            items={[
              <>
                El organizador corre el sorteo desde su panel. La secuencia de
                balotas queda <strong>grabada con fecha y hora</strong> en ese
                momento.
              </>,
              <>
                Luego las va <strong>cantando una por una</strong> y en el
                enlace público todos ven salir cada balota en vivo, como un
                baloto.
              </>,
              <>
                Puede tener <strong>finalistas</strong>: por ejemplo, salen 5
                números y de esos 5 se sortea el ganador.
              </>,
              <>
                Al terminar se publica el ganador (con el nombre enmascarado) y
                cualquiera puede volver a ver el sorteo tal como ocurrió.
              </>,
            ]}
          />
          <p>
            Como la secuencia queda guardada antes de cantarse, el organizador
            no puede &quot;repetir&quot; una balota que no le gustó sin que
            quede en evidencia.
          </p>
        </Seccion>

        <Seccion id="rifas-grandes" titulo="🏍️ Rifas de 10.000 números">
          <p>
            Las rifas grandes, como una moto con números de $1.500 a $2.000,
            funcionan igual, con algunos detalles:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-white">
                Números de 4 cifras (0000–9999).
              </strong>{" "}
              Si es con lotería, se juega con las 4 cifras del premio mayor (lo
              normal es usar las <strong>últimas 4</strong>).
            </li>
            <li>
              <strong className="text-white">Mínimo por compra.</strong> El
              organizador puede pedir, por ejemplo,{" "}
              <strong>mínimo 10 números</strong> por compra. Los eliges{" "}
              <strong>al azar</strong>, <strong>seguidos</strong> (ej. 4520 a
              4529) o <strong>a mano</strong>, con un toque.
            </li>
            <li>
              <strong className="text-white">La grilla va por bloques.</strong>{" "}
              Eliges el millar y la centena (cada bloque dice cuántos libres le
              quedan) o buscas tu número directamente.
            </li>
            <li>
              <strong className="text-white">¿Lotería o sorteo propio?</strong>{" "}
              Con lotería el resultado es externo y nadie lo controla, pero si
              no se venden todos, el número ganador puede quedar sin dueño. Con
              sorteo propio siempre gana alguien que compró. Las dos son
              válidas; lo importante es que la regla esté escrita antes de
              vender.
            </li>
          </ul>
          {/* Las cuentas de ejemplo y la calculadora son para organizadores con
              sesión: al comprador no le sirven y no tiene por qué ver el margen. */}
          {membership && (
            <Ejemplo>
              <strong className="text-white">Ejemplo:</strong> moto de
              $6.200.000 (con matrícula y SOAT), 10.000 números a $1.800 y
              mínimo 10 por compra (cada compra sale en $18.000). Si se vende
              todo, recauda $18.000.000; para no perder necesita vender unos
              3.528 números (35%). Haz tus propias cuentas en la{" "}
              <Link
                href="/precios"
                className="text-polla-gold underline underline-offset-4"
              >
                calculadora de ganancias
              </Link>
              .
            </Ejemplo>
          )}
        </Seccion>

        <Seccion id="organizadores" titulo="📋 Si organizas la rifa">
          <Pasos
            items={[
              <>
                Crea la rifa: premio, precio, cantidad de números y mínimo por
                compra.
              </>,
              <>
                Elige cómo se sortea: <strong>lotería</strong> (cuál, qué fecha
                y con qué cifras) o <strong>sorteo propio</strong> (cuántas
                balotas y finalistas).
              </>,
              <>
                Si es con lotería, escribe en la descripción qué pasa si el
                número ganador no se vendió.
              </>,
              <>Activa la rifa y comparte el enlace o el flyer.</>,
              <>
                Marca como <strong>pagado</strong> cada número a medida que te
                paguen: por defecto, solo los pagados juegan.
              </>,
              <>
                El día del sorteo, ingresa el resultado de la lotería o corre el
                sorteo propio y cántalo en vivo. Después publica el ganador.
              </>,
            ]}
          />
        </Seccion>

        <Seccion id="compradores" titulo="🙋 Si vas a comprar">
          <Pasos
            items={[
              <>
                Abre el enlace de la rifa y revisa el premio, la fecha y{" "}
                <strong>cómo se sortea</strong>.
              </>,
              <>
                Elige tus números (al azar, seguidos o a mano) y reserva con tu
                nombre y teléfono.
              </>,
              <>
                Paga directamente al organizador por el medio que indica la
                página. <strong>El pago no pasa por {MARCA.nombre}.</strong>
              </>,
              <>
                Asegúrate de que te marque como pagado: si la rifa dice
                &quot;solo juegan las pagadas&quot;, un número apartado sin
                pagar no participa.
              </>,
              <>El día del sorteo, sigue el resultado en el mismo enlace.</>,
            ]}
          />
          <p>
            En la página pública nadie ve tu nombre ni tu teléfono: un número
            tomado solo aparece como <strong>ocupado</strong>, y el ganador se
            publica con el nombre enmascarado.
          </p>
        </Seccion>

        <Seccion titulo="⚖️ Importante">
          <p>
            {MARCA.nombre} es una herramienta de{" "}
            <strong>gestión y organización</strong>. No organiza, no opera ni
            avala rifas, no recibe el dinero de las boletas y no entrega
            premios. Los permisos que exija la ley (en Colombia, ante Coljuegos
            o la entidad territorial que corresponda), los impuestos y la
            entrega del premio son responsabilidad de quien organiza la rifa.
            Más detalle en los{" "}
            <Link
              href="/terminos"
              className="text-polla-gold underline underline-offset-4"
            >
              términos y condiciones
            </Link>
            .
          </p>
        </Seccion>
      </main>
      <SiteFooter />
    </>
  );
}
