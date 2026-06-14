/**
 * Confetti minimalista sin dependencias, basado en la Web Animations API.
 * Lanza una ráfaga de papelitos con los colores de la marca y limpia el DOM
 * cuando terminan. Pensado para celebrar un pronóstico confirmado.
 */
const COLORES = ["#f5c518", "#e94560", "#ffffff", "#0f3460"];

export function lanzarConfetti(cantidad = 90): void {
  if (typeof window === "undefined") return;
  // Respeta la preferencia de reducir movimiento.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  for (let i = 0; i < cantidad; i++) {
    const pieza = document.createElement("div");
    const tam = 6 + Math.random() * 6;
    pieza.style.cssText = `position:absolute;top:-5vh;left:${Math.random() * 100}vw;width:${tam}px;height:${tam * 0.4}px;background:${COLORES[i % COLORES.length]};border-radius:1px;opacity:0.9`;
    container.appendChild(pieza);

    const caidaX = (Math.random() - 0.5) * 240;
    const giro = 360 + Math.random() * 720;
    pieza.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${caidaX}px, 105vh) rotate(${giro}deg)`,
          opacity: 0.9,
        },
      ],
      {
        duration: 2200 + Math.random() * 1500,
        easing: "cubic-bezier(0.2, 0.6, 0.4, 1)",
        delay: Math.random() * 250,
        fill: "forwards",
      },
    );
  }

  window.setTimeout(() => container.remove(), 4200);
}
