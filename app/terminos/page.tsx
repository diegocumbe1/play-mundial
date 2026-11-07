import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";
import { MARCA } from "@/lib/marca";

export const dynamic = "force-dynamic";

/**
 * Términos de la plataforma: rifas y torneos.
 *
 * Punto clave del modelo y por eso está explícito abajo: la plataforma NO
 * organiza rifas ni torneos, no recibe el dinero de boletas o inscripciones ni
 * entrega los premios. Eso es del organizador.
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
          {MARCA.nombre} es una herramienta para organizar rifas y torneos
          deportivos. Al usarla —como organizador, participante, equipo o jugador—
          aceptas estas condiciones.
        </p>
        <p className="text-polla-muted mt-2 text-xs">
          Última actualización: 7 de noviembre de 2026.
        </p>

        <Seccion titulo="1. Qué es y qué no es esta plataforma">
          <p>
            {MARCA.nombre} le da al <strong>organizador</strong> las herramientas
            para armar su rifa o su torneo: publicar un enlace, recibir reservas o
            inscripciones, registrar quién pagó, correr el sorteo, programar los
            partidos y publicar los resultados.
          </p>
          <p>
            <strong>
              La plataforma no organiza rifas ni torneos, no recibe el dinero de
              boletas o inscripciones y no entrega los premios.
            </strong>{" "}
            Cada rifa o torneo es responsabilidad de quien lo crea: define las
            condiciones, cobra directamente y entrega los premios. Cualquier reclamo
            sobre premios, dinero, devoluciones o el desarrollo del evento se
            resuelve con el organizador.
          </p>
        </Seccion>

        <Seccion titulo="2. Del organizador">
          <p>
            Al crear una rifa o un torneo, el organizador se compromete a publicar
            información veraz sobre premios, precios, fechas y reglas; entregar los
            premios a quien corresponda; cumplir las normas que le apliquen en su
            país o ciudad, incluidos los permisos del evento; y responder por el
            dinero que recibe.
          </p>
          <p>
            Debe verificar su correo antes de registrar el primer número de una
            rifa, y su cuenta puede requerir aprobación antes de publicar. Podemos
            suspender una cuenta, una rifa o un torneo ante indicios de fraude,
            suplantación, falta de pago a la plataforma o incumplimiento de estas
            condiciones.
          </p>
          <p>
            Si se suspende una cuenta, sus rifas dejan de verse. Sus torneos siguen
            visibles con partidos y resultados, pero no reciben inscripciones ni
            muestran datos de cobro.
          </p>
        </Seccion>

        <Seccion titulo="3. Rifas: del participante">
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

        <Seccion titulo="4. Rifas: el sorteo">
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

        <Seccion titulo="5. Torneos: inscripción y participación">
          <p>
            Inscribir un equipo envía una <strong>solicitud</strong>: el cupo solo
            queda asegurado cuando el organizador la confirma. El valor de la
            inscripción se paga al organizador por el medio que este indique y{" "}
            <strong>no pasa por la plataforma</strong>. Las devoluciones dependen
            del organizador.
          </p>
          <p>
            Quien inscribe al equipo acepta el reglamento publicado por el
            organizador y declara que los datos son correctos y que está autorizado
            para entregar los datos de sus jugadores. Si un jugador es menor de
            edad, debe contar además con la autorización de su representante.
          </p>
          <p>
            Las reglas de participación, el formato, las sanciones y la premiación
            los define el organizador.{" "}
            <strong>
              La plataforma no organiza el encuentro deportivo ni responde por
              lesiones, daños, cancelaciones o cambios de programación.
            </strong>
          </p>
        </Seccion>

        <Seccion titulo="6. Torneos: marcador y resultados">
          <p>
            El marcador en vivo lo lleva la persona a cargo del partido y se muestra
            a modo informativo mientras se juega.{" "}
            <strong>El resultado oficial es el que confirma el organizador.</strong>{" "}
            Con ese resultado se calculan la tabla y las llaves, según las reglas de
            desempate configuradas en el torneo.
          </p>
          <p>
            Cualquier reclamo sobre un resultado, un arbitraje o una decisión
            deportiva se resuelve con el organizador, según su reglamento.
          </p>
        </Seccion>

        <Seccion titulo="7. Planes y cobros de la plataforma">
          <p>
            Lo que se cobra es el <strong>uso de la herramienta</strong>, no una
            comisión sobre las ventas o inscripciones del organizador. Los precios
            de rifas se publican en la página de planes. Los de torneos se informan
            antes de publicar y dependen del cupo de equipos o de su suscripción
            mensual, que es aparte de la de rifas.
          </p>
          <p>
            El precio se congela al activar la rifa o el torneo: cambios posteriores
            en las tarifas no afectan los ya activados. Los cupos del plan gratuito
            se cuentan por organizador y no se reponen al borrar una rifa o un
            torneo.
          </p>
        </Seccion>

        <Seccion titulo="8. Privacidad">
          <p>
            Del <strong>participante de una rifa</strong> guardamos nombre y
            teléfono, con el único fin de que el organizador identifique su compra y
            pueda contactarlo. Esos datos son visibles para el organizador de esa
            rifa, nunca para otros participantes.
          </p>
          <p>
            En la página pública de una rifa, un número tomado se muestra solo como{" "}
            <strong>ocupado</strong>: nunca se revela quién lo tiene ni si ya pagó.
            Los ganadores se publican con el nombre enmascarado (&quot;Di**** Cu***&quot;)
            y sin teléfono.
          </p>
          <p>
            De un <strong>equipo de torneo</strong> guardamos los datos de su
            responsable (nombre, teléfono y correo), sus pagos y los datos de sus
            jugadores que pida el torneo, como nombre, documento y género. Sirven
            para gestionar la inscripción y validar las reglas de participación, y
            solo los ve el organizador de ese torneo.
          </p>
          <p>
            En la página pública de un torneo se muestran el nombre del equipo, los
            partidos, los resultados y las posiciones. Nunca se publican los datos
            de contacto, los documentos ni los pagos.
          </p>
          <p>
            Del <strong>organizador</strong> guardamos nombre, correo y WhatsApp
            para administrar su cuenta, y sus dispositivos si activa las
            notificaciones. El organizador responde por el uso que les dé a los datos
            de sus participantes y equipos. No vendemos ni compartimos datos con
            terceros. Para consultar, corregir o eliminar tus datos, escríbenos por
            los canales de contacto de la plataforma.
          </p>
        </Seccion>

        <Seccion titulo="9. Responsabilidad">
          <p>
            La plataforma se ofrece tal como está y no garantiza disponibilidad
            ininterrumpida, incluido el marcador en vivo y las notificaciones. No
            somos responsables por el incumplimiento del organizador frente a sus
            participantes o equipos, por el dinero que este reciba, ni por el uso
            que le dé a la herramienta.
          </p>
          <p>
            Ante cualquier inconsistencia técnica verificable, haremos lo
            razonable por corregirla; la relación comercial de una rifa o un torneo
            es siempre entre el organizador y sus participantes o equipos.
          </p>
        </Seccion>
      </main>
      <SiteFooter />
    </>
  );
}
