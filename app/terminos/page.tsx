import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";
import { formatCOP, POLLA } from "@/lib/polla";

export const dynamic = "force-dynamic";

const CASA_PCT = Math.round(POLLA.porcentajeCasa * 100);
const PREMIO_PCT = 100 - CASA_PCT;

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-heading mb-2 text-xl tracking-wide text-white">
        {titulo}
      </h2>
      <div className="text-polla-muted space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default async function TerminosPage() {
  const idioma = await getIdioma();

  return (
    <>
      <SiteHeader idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
          Términos, condiciones y privacidad
        </h1>
        <p className="text-polla-muted mt-3 text-sm">
          Polla recreativa entre conocidos para el Mundial 2026. Al participar
          aceptas estas condiciones.
        </p>

        <Seccion titulo="1. Cómo funciona">
          <p>
            Cada partido es una polla <strong>independiente</strong>: no se
            acumulan puntos ni saldo entre partidos. Apostar a un partido cuesta{" "}
            <strong>{formatCOP(POLLA.costo)}</strong>. Puedes apostar a varios
            partidos y varias veces al mismo partido (cada apuesta es un cobro
            aparte).
          </p>
        </Seccion>

        <Seccion titulo="2. Cómo se gana">
          <p>
            Gana quien acierte el <strong>marcador exacto</strong> (goles de cada
            equipo) del partido. No hay premio por “aproximado” ni por acertar
            solo al ganador.
          </p>
          <p>
            El <strong>pozo</strong> de un partido es la suma de las apuestas
            pagadas de ese partido. Del pozo, los acertantes se reparten en
            partes iguales el <strong>{PREMIO_PCT}%</strong> (premio) y la casa
            retiene el <strong>{CASA_PCT}%</strong>. Si hay varios ganadores, el
            premio se divide por igual entre ellos.
          </p>
          <p>
            Si <strong>nadie acierta</strong> el marcador exacto, todo el pozo de
            ese partido queda para la casa.
          </p>
        </Seccion>

        <Seccion titulo="3. Pagos">
          <p>
            El pago se realiza por transferencia <strong>antes</strong> de
            participar, a los datos indicados al confirmar la apuesta
            ({POLLA.banco.entidad} · {POLLA.banco.numero} ·{" "}
            {POLLA.banco.titular}). La apuesta se considera válida una vez el
            administrador confirma el pago.
          </p>
          <p>
            El premio se entrega a los ganadores por el mismo medio una vez
            finalizado el partido y verificado el resultado oficial.
          </p>
        </Seccion>

        <Seccion titulo="4. Resultados">
          <p>
            El marcador válido es el del <strong>tiempo reglamentario</strong>{" "}
            del partido según la fuente oficial de datos usada por la plataforma.
            Tiempos extra y penales no modifican el marcador para efectos de la
            polla, salvo que se indique lo contrario.
          </p>
        </Seccion>

        <Seccion titulo="5. Privacidad">
          <p>
            Solo recolectamos tu <strong>nombre</strong> y, opcionalmente, tu{" "}
            <strong>teléfono</strong>, con el fin de gestionar la polla,
            identificar tus apuestas y contactarte si ganas. No vendemos ni
            compartimos tus datos con terceros.
          </p>
        </Seccion>

        <Seccion titulo="6. Responsabilidad">
          <p>
            Esta es una plataforma recreativa y sin ánimo de lucro entre
            conocidos. La organización no se hace responsable por errores en los
            datos de los partidos provistos por terceros; ante cualquier
            inconsistencia, la decisión del administrador es final.
          </p>
        </Seccion>
      </main>
      <SiteFooter />
    </>
  );
}
