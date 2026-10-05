import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";
import { MARCA } from "@/lib/marca";

export const dynamic = "force-dynamic";

/**
 * Términos de la plataforma de rifas.
 *
 * Punto clave del modelo y por eso está explícito abajo: la plataforma NO
 * organiza rifas, no recibe el dinero de las boletas ni entrega los premios.
 * Eso es del organizador. Los términos anteriores describían la mecánica de la
 * polla del Mundial (pozo, 20% para la casa, marcador exacto), que no aplica a
 * nada de lo que hace hoy el producto.
 */
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
          {MARCA.nombre} es una herramienta para organizar rifas y dinámicas. Al
          usarla —como organizador o como participante— aceptas estas condiciones.
        </p>

        <Seccion titulo="1. Qué es y qué no es esta plataforma">
          <p>
            {MARCA.nombre} le da al <strong>organizador</strong> las herramientas
            para armar su rifa: publicar el enlace, llevar el control de los
            números, registrar quién pagó y correr el sorteo.
          </p>
          <p>
            <strong>
              La plataforma no organiza la rifa, no recibe el dinero de las
              boletas y no entrega los premios.
            </strong>{" "}
            Cada rifa es responsabilidad de quien la crea: él define el premio,
            cobra directamente a sus participantes y hace la entrega. Cualquier
            reclamo sobre el premio o el dinero se resuelve con el organizador.
          </p>
        </Seccion>

        <Seccion titulo="2. Del organizador">
          <p>Al crear una rifa, el organizador se compromete a:</p>
          <p>
            Publicar información veraz sobre el premio, el precio y la fecha del
            sorteo; entregar el premio a quien resulte ganador; cumplir las normas
            que le apliquen en su país o ciudad; y responder por el manejo del
            dinero que recibe de los participantes.
          </p>
          <p>
            Debe verificar su correo antes de registrar el primer número, y su
            cuenta puede requerir aprobación antes de publicar. Podemos suspender
            una cuenta o una rifa ante indicios de fraude, suplantación o
            incumplimiento de estas condiciones.
          </p>
        </Seccion>

        <Seccion titulo="3. Del participante">
          <p>
            Al reservar un número, el participante aparta ese puesto y se
            compromete a pagarlo al organizador por el medio que este indique. El
            pago <strong>no pasa por la plataforma</strong>.
          </p>
          <p>
            Si el organizador configuró la rifa como{" "}
            <strong>&quot;solo juegan las boletas pagadas&quot;</strong>, un número
            reservado y no pagado no participa en el sorteo. Esa condición se
            muestra en la página pública de cada rifa antes de reservar.
          </p>
        </Seccion>

        <Seccion titulo="4. El sorteo">
          <p>
            En las rifas de <strong>sorteo propio</strong>, los números salen con
            un generador aleatorio del servidor y la secuencia queda grabada con su
            fecha: se puede volver a ver tal como ocurrió, y el organizador no
            puede repetir una balota que no le gustó sin que quede en evidencia.
          </p>
          <p>
            En las rifas atadas a una <strong>lotería</strong>, gana quien tenga el
            número que coincida con las cifras del resultado oficial, según lo que
            se anuncia en la página de la rifa.
          </p>
        </Seccion>

        <Seccion titulo="5. Planes y cobros de la plataforma">
          <p>
            Lo que se cobra es el <strong>uso de la herramienta</strong>, no una
            comisión sobre las ventas del organizador. Los precios vigentes están
            en la página de planes.
          </p>
          <p>
            El precio de una rifa se congela al momento de activarla: cambios
            posteriores en las tarifas no afectan rifas ya activadas. Los cupos del
            plan gratuito se cuentan por organizador y no se reponen al borrar una
            rifa.
          </p>
        </Seccion>

        <Seccion titulo="6. Privacidad">
          <p>
            Del <strong>participante</strong> guardamos nombre y teléfono, con el
            único fin de que el organizador identifique su compra y pueda
            contactarlo. Esos datos son visibles para el organizador de esa rifa,
            nunca para otros participantes.
          </p>
          <p>
            En la página pública un número tomado se muestra solo como{" "}
            <strong>ocupado</strong>: nunca se revela quién lo tiene ni si ya pagó.
            Los ganadores se publican con el nombre enmascarado (&quot;Di**** Cu***&quot;)
            y sin teléfono.
          </p>
          <p>
            Del <strong>organizador</strong> guardamos nombre, correo y WhatsApp
            para administrar su cuenta. No vendemos ni compartimos datos con
            terceros. Para consultar, corregir o eliminar tus datos, escríbenos por
            los canales de contacto de la plataforma.
          </p>
        </Seccion>

        <Seccion titulo="7. Responsabilidad">
          <p>
            La plataforma se ofrece tal como está y no garantiza disponibilidad
            ininterrumpida. No somos responsables por el incumplimiento del
            organizador frente a sus participantes, por el dinero que este reciba,
            ni por el uso que le dé a la herramienta.
          </p>
          <p>
            Ante cualquier inconsistencia técnica verificable, haremos lo
            razonable por corregirla; la relación comercial de una rifa es siempre
            entre el organizador y sus participantes.
          </p>
        </Seccion>
      </main>
      <SiteFooter />
    </>
  );
}
