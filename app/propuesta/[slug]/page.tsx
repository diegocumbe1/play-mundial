import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  equiposParaCubrir,
  getPropuesta,
  type Disponibilidad,
} from "@/lib/propuestas";
import { formatCOP, labelPuesto } from "@/lib/torneos";

/**
 * Propuesta comercial para presentar en vivo al cliente. Los valores salen de
 * `src/lib/propuestas.ts`: esta página no tiene ningún número escrito a mano.
 * Fuera de buscadores: el enlace solo lo tiene quien está en la reunión.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getPropuesta(slug);
  return {
    title: p ? `Propuesta · ${p.evento.nombre}` : "Propuesta",
    robots: { index: false, follow: false },
  };
}

function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-polla-line/70 border-t py-12">
      <p className="text-polla-gold mb-1 text-xs font-semibold tracking-[0.2em]">
        {numero}
      </p>
      <h2 className="font-heading mb-6 text-3xl tracking-wide text-white sm:text-4xl">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Proximamente({ estado }: { estado: Disponibilidad }) {
  if (estado === "incluido") return null;
  return (
    <span className="border-polla-gold/40 text-polla-gold ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
      Próximamente
    </span>
  );
}

export default async function PropuestaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPropuesta(slug);
  if (!p) notFound();

  const totalPremios = p.categorias.reduce(
    (s, c) => s + c.premios.reduce((a, v) => a + v, 0),
    0,
  );
  const whatsapp = p.contacto.whatsapp.replace(/\D/g, "");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
      {/* --- Portada --- */}
      <header className="pb-12">
        <p className="text-polla-muted text-sm">
          {p.marca} · Propuesta para {p.cliente.nombre}
        </p>
        <h1 className="font-heading mt-3 text-5xl leading-none tracking-wide text-white sm:text-7xl">
          {p.evento.nombre}
        </h1>
        <p className="text-polla-gold mt-3 text-lg font-semibold">
          {p.evento.deporte} · {p.cliente.ciudad}
        </p>
        <p className="text-polla-muted mt-6 max-w-2xl text-base leading-relaxed">
          Una suscripción a nuestra plataforma para que ustedes gestionen el
          torneo de principio a fin desde el celular: inscripciones, pagos,
          fixture, marcador en vivo y resultados. Con una guía paso a paso y sin
          conocimientos técnicos.
        </p>
      </header>

      {/* --- El torneo en números --- */}
      <Seccion numero="01" titulo="Su torneo en números">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Fechas", valor: p.evento.fechas },
            { label: "Inscripción por equipo", valor: formatCOP(p.evento.inscripcion) },
            { label: "Premiación total", valor: formatCOP(totalPremios) },
          ].map((d) => (
            <div key={d.label} className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-polla-muted text-xs">{d.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{d.valor}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {p.categorias.map((c) => {
            const minimo = equiposParaCubrir(c.premios, p.evento.inscripcion);
            return (
              <div key={c.nombre} className="border-polla-line rounded-2xl border p-5">
                <p className="font-heading text-3xl tracking-wide text-white">
                  {c.nombre}
                </p>
                <p className="text-polla-muted text-xs">{c.detalle}</p>
                <ul className="mt-4 space-y-1 text-sm">
                  {c.premios.map((v, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-polla-muted">{labelPuesto(i + 1)}</span>
                      <span className="font-semibold text-white">{formatCOP(v)}</span>
                    </li>
                  ))}
                </ul>
                {minimo && (
                  <p className="bg-polla-gold/10 text-polla-gold mt-4 rounded-lg px-3 py-2 text-xs">
                    Se necesitan <b>{minimo} equipos</b> para cubrir la premiación
                    solo con inscripciones. La plataforma les avisa si no se
                    alcanza.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* --- Qué incluye --- */}
      <Seccion numero="02" titulo="Qué incluye la suscripción">
        <div className="grid gap-4 sm:grid-cols-2">
          {p.incluye.map((item) => (
            <div key={item.titulo} className="rounded-xl bg-white/[0.04] p-4">
              <p className="font-semibold text-white">
                {item.titulo}
                <Proximamente estado={item.estado} />
              </p>
              <p className="text-polla-muted mt-1 text-sm leading-relaxed">
                {item.detalle}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* --- Grandes ligas --- */}
      <Seccion numero="03" titulo="Lo que hacen las grandes ligas, en su torneo">
        <p className="text-polla-muted mb-6 max-w-2xl text-sm leading-relaxed">
          Las federaciones automatizan para que nadie transcriba resultados ni
          revise reglas a mano. Tomamos esas prácticas y las llevamos a un torneo
          de barrio: menos errores, menos discusiones y menos tiempo de ustedes.
        </p>
        <div className="space-y-3">
          {p.referentes.map((r) => (
            <div
              key={r.fuente}
              className="border-polla-line grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_1fr]"
            >
              <div>
                <p className="text-polla-gold text-xs font-semibold">{r.fuente}</p>
                <p className="text-polla-muted mt-1 text-sm">{r.practica}</p>
              </div>
              <p className="text-sm text-white">
                {r.aqui}
                <Proximamente estado={r.estado} />
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* --- Paso a paso --- */}
      <Seccion numero="04" titulo="Cómo se lleva el torneo">
        <ol className="space-y-3">
          {p.pasos.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-4 rounded-xl bg-white/[0.04] p-4">
              <span className="bg-polla-gold text-polla-dark flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-white">{paso.titulo}</p>
                <p className="text-polla-muted text-sm">{paso.detalle}</p>
              </div>
              <span className="text-polla-gold shrink-0 text-xs font-semibold">
                {paso.tiempo}
              </span>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* --- Lo que necesitamos --- */}
      <Seccion numero="05" titulo="Para arrancar necesitamos">
        <ul className="grid gap-2 sm:grid-cols-2">
          {p.necesitamos.map((n) => (
            <li key={n} className="text-polla-muted flex gap-2 text-sm">
              <span className="text-polla-gold">✓</span>
              {n}
            </li>
          ))}
        </ul>
      </Seccion>

      {/* --- Inversión --- */}
      <Seccion numero="06" titulo="Inversión">
        <div className="grid gap-4 sm:grid-cols-2">
          {p.planes.map((plan) => (
            <div
              key={plan.nombre}
              className={`rounded-2xl border p-6 ${
                plan.destacado
                  ? "border-polla-gold bg-polla-gold/5"
                  : "border-polla-line"
              }`}
            >
              <p className="text-sm font-semibold text-white">{plan.nombre}</p>
              <p className="font-heading mt-2 text-4xl tracking-wide text-white">
                {plan.precio == null ? "Por definir" : formatCOP(plan.precio)}
              </p>
              <p className="text-polla-muted text-xs">{plan.unidad}</p>
              <p className="text-polla-muted mt-3 text-sm">{plan.detalle}</p>
            </div>
          ))}
        </div>
        <p className="text-polla-muted mt-4 text-xs">{p.vigencia}</p>
      </Seccion>

      {/* --- Cierre --- */}
      <footer className="border-polla-line/70 border-t py-12 text-center">
        <p className="font-heading text-3xl tracking-wide text-white">
          ¿Arrancamos?
        </p>
        <p className="text-polla-muted mt-2 text-sm">
          {p.contacto.nombre} · {p.marca}
        </p>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
              `Hola, quiero arrancar con ${p.evento.nombre}.`,
            )}`}
            className="bg-polla-gold text-polla-dark mt-6 inline-block rounded-full px-6 py-3 text-sm font-bold"
          >
            Escribir por WhatsApp
          </a>
        )}
      </footer>
    </main>
  );
}
