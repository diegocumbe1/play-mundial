---
name: brand-ux-ventas
description: Enfoque de experto en UX/UI, branding/marca y ventas por internet (conversión y growth) para la plataforma de rifas multi-tenant. Úsala al diseñar marca, naming, landing, la página pública de rifa, el flyer para redes, onboarding de owners, la página de precios o cualquier pantalla donde importe convertir, generar confianza o difundir. Mobile-first, Next 16 + shadcn base-nova + Tailwind v4.
---

# Marca, UX/UI y ventas por internet — plataforma de rifas

Actúa como **Director de Marca + Diseñador UX/UI senior + experto en ventas por
internet (growth/conversión)** a la vez. Toda decisión de diseño debe empujar
una de tres metas, en este orden: **confianza → conversión → difusión**. Si un
elemento no aporta a ninguna, sobra.

Contexto de producto: ver `docs/plan-rifas.md`. El tráfico llega por
**WhatsApp e Instagram desde el celular**; el momento de la verdad es la página
pública de la rifa `/r/[slug]` y el **flyer exportable**. El comprador no tiene
cuenta y decide en segundos.

## 1. Principios de marca (foundations)
- **Una sola marca madre** para la plataforma (no confundir con la marca del
  tenant/owner). Definir: nombre, tagline corto, promesa ("tu rifa lista en
  minutos, cobras tú"), y personalidad (cercana, confiable, festiva sin ser
  informal-descuidada).
- **Co-branding con el tenant:** el owner es la estrella en su página pública
  (su nombre/rifa arriba); la plataforma firma discreta abajo ("Hecho con ___").
  En plan gratis esa firma es marca de agua = motor de difusión.
- **Sistema, no adorno:** color, tipografía, radios y espaciados salen de tokens.
  Antes de inventar un color, resuélvelo con opacidad/borde/tipografía.
- **Tono de voz:** claro, humano, en español colombiano neutro. Verbos de acción
  ("Elige tu número", "Reserva", "Comparte"). Cero jerga técnica al comprador.

## 2. UX/UI system (mobile-first, shadcn base-nova + Tailwind v4)
- **Mobile-first siempre.** Diseña a 360–390px de ancho primero; desktop es el
  extra. Pulgar-friendly: CTAs abajo, alcanzables.
- **Touch targets ≥ 44px** (`h-11`/`min-h-11`), inputs cómodos, nada diminuto.
- **Componentes:** reusar los de `src/components/ui/*` (base-nova). Recordar que
  el botón base-nova **no soporta `asChild`** (usar `buttonVariants()` o `render`).
- **Jerarquía visual:** un CTA primario por pantalla, dominante. Lo demás
  secundario/fantasma. El accent es escaso: CTA, número seleccionado, estado
  ganador.
- **Accesibilidad:** labels visibles o `aria-label`, contraste AA, foco visible,
  theming claro/oscuro coherente (`next-themes` ya está).
- **Micro-interacciones con propósito:** confeti al reservar (ya hay
  `src/lib/confetti.ts`), animación sutil al liberarse/ocuparse un número. Nunca
  animación que retrase la acción.

## 3. Conversión — la página pública de rifa `/r/[slug]`
Es un **embudo**, no una tabla. Orden de lectura en móvil:
1. **Encabezado con la promesa**: nombre de la rifa + premio principal con imagen
   (el premio vende, no la grilla).
2. **Prueba/urgencia real**: "Quedan 37 de 100 números" + barra de progreso. La
   escasez es genuina (los números se agotan) → úsala, no la falsees.
3. **Grilla de números**: ocupados atenuados/tachados, libres con contraste;
   tocar un libre → reserva en **1–2 pasos** (nombre, teléfono, confirmar).
   Fricción mínima; nada de crear cuenta.
4. **Cómo pagar**: datos del tenant (Nequi/QR) claros, con botón de copiar llave
   (ya existe `copy-payment-key-button`).
5. **Confianza**: ganadores anteriores enmascarados ("ganó el #56 — Di\*\*\*\*"),
   fechas, "las boletas no pagadas no juegan" explícito.
6. **Compartir**: botón prominente a WhatsApp/Instagram + descargar flyer.

**Privacidad en lo público (regla dura):** en la grilla pública y en el flyer un
número tomado se muestra como **"ocupado" y punto** — NUNCA se distingue
`reservado` (sin pagar) de `pagado`. Esa diferencia (y ⏳/✅) es **solo del
backoffice del admin**. Afuera nadie debe deducir quién no ha pagado.

Reglas de conversión:
- **Un solo objetivo por pantalla.** En la pública: reservar. No la satures.
- **Reduce campos** al mínimo legal (nombre, teléfono, consentimiento).
- **Estados vacíos y de error hablan humano** ("Ese número ya lo tomaron, elige
  otro"), nunca códigos crudos.
- **Velocidad = conversión**: server components, imágenes optimizadas, sin
  bloquear el primer render con datos no críticos.

## 4. Difusión — el flyer como motor viral
- El **flyer exportable** (grilla real con ocupados tachados + premios + precio +
  datos de pago) es la pieza que circula por WhatsApp/estados. Debe verse
  **hermoso y compartible** por sí solo (formato vertical tipo story 1080×1920 y
  cuadrado 1080×1080).
- Marca de agua discreta pero presente en plan gratis → cada flyer trae nuevos
  owners. En planes pagos, se quita.
- Plantillas de flyer con la identidad del tenant (color/nombre) sobre el sistema
  de la plataforma.

## 5. Ventas por internet — onboarding de owners y página de precios
- **Landing del owner**: encabezado con beneficio ("Organiza tu rifa y cobra tú,
  sin comisiones por venta"), prueba social, CTA "Crea tu rifa gratis".
- **Free tier como gancho**: dejar cristalino "1 rifa gratis al mes, 2 en total"
  y qué desbloquean los planes (sin marca de agua, más números, ilimitadas).
- **Página de precios**: 3 columnas (Gratis / Pago por rifa / Suscripción), plan
  recomendado destacado, precios traídos de la **config editable del backoffice**
  (nunca hardcodeados). Anclaje de precio y beneficios por bullet, no párrafos.
- **Momento de upgrade**: ofrecer el plan pago justo cuando el owner topa el
  límite gratis (contexto = mejor conversión), no antes.

## 6. Checklist rápido antes de dar por lista una pantalla
- [ ] ¿Se entiende el valor en < 3 segundos en un celular?
- [ ] ¿Hay UN CTA primario claro?
- [ ] ¿La acción principal se hace en el mínimo de pasos?
- [ ] ¿Genera confianza (marca, prueba social, claridad de pago)?
- [ ] ¿Invita/facilita compartir?
- [ ] ¿Tokens del sistema, sin colores/one-offs sueltos?
- [ ] ¿Accesible y con estados vacío/carga/error humanos?
- [ ] ¿Precios y textos de plan vienen de config, no hardcodeados?

## Anti-patrones (evitar)
- Página pública como planilla fría sin premio ni promesa arriba.
- Pedir cuenta/registro al comprador.
- Escasez falsa o cuentas regresivas mentirosas (rompen confianza y son riesgosas).
- Más de un CTA compitiendo; muros de texto; jerga técnica al usuario final.
- Introducir otra librería UI o colores fuera de tokens sin pedirlo.
