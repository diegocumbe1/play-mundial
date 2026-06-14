import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hero del home: cielo de estadio nocturno, mensaje y CTA dorado. */
export function Hero() {
  return (
    <section className="bg-hero ring-polla-line relative overflow-hidden rounded-3xl ring-1">
      <div className="bg-stadium absolute inset-0" aria-hidden />
      {/* Partículas/luces flotantes muy sutiles */}
      <div
        className="bg-polla-gold/10 animate-float absolute -top-16 -right-10 size-48 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        className="bg-polla-red/10 animate-float absolute -bottom-20 -left-10 size-56 rounded-full blur-3xl [animation-delay:2s]"
        aria-hidden
      />

      <div className="relative px-6 py-14 sm:px-12 sm:py-20">
        <span className="text-polla-gold/90 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest uppercase ring-1 ring-white/10">
          🏆 FIFA World Cup 2026
        </span>

        <h1 className="font-heading mt-6 max-w-3xl text-5xl leading-[0.95] tracking-wide text-white sm:text-7xl">
          Pronostica.{" "}
          <span className="text-polla-gold">Compite.</span>{" "}
          <span className="text-polla-red">Gana.</span>
        </h1>

        <p className="text-polla-muted mt-4 max-w-xl text-base sm:text-lg">
          Apuesta por partido y acierta el marcador exacto para llevarte el
          premio. Cada partido es su propia polla: no se acumula.
        </p>

        <div className="mt-8">
          <Link
            href="/jugar"
            className={cn(
              buttonVariants({ size: "lg" }),
              "shimmer bg-polla-gold text-polla-dark hover:bg-polla-gold/90 h-12 gap-2 rounded-xl px-7 text-base font-bold shadow-[0_8px_30px_-8px_rgba(245,197,24,0.6)]",
            )}
          >
            Registrar mis pronósticos
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
