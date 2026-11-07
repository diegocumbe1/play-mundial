# Cuánto cobrar por torneos

> Propuesta del 7 de noviembre de 2026. Los precios son un punto de partida para validar con clientes reales, no un dato del mercado.

## Respuesta corta

- **$100.000 a Fase 4 no es mucho.** Es razonable, incluso algo bajo. Cóbralos.
- **Preséntalo como precio de fundador:** precio normal $150.000, y $100.000 por ser el primero.
- **No compitas contra lo gratis.** Cobra por lo que las herramientas gratis no suelen resolver juntas: el partido en vivo y las cuentas del torneo.

## Por qué $100.000 es razonable para Fase 4

Con los datos de la propuesta: inscripción de $200.000 por equipo y $4.050.000 en premios.

| Si inscribe | Recauda | Los $100.000 equivalen a |
|---|---|---|
| 21 equipos (cubre premios) | $4.200.000 | 2,4% del recaudo |
| 30 equipos (ejemplo de la demo) | $6.000.000 | 1,7% del recaudo |

Dicho de forma simple: **cuesta medio cupo de un equipo**, o unos $3.400 por equipo si son 30.

Ojo: esos 30 equipos vienen de la demo, no de inscritos reales.

## Qué cobran otros

Precios tomados de listados y comparadores, sin confirmar en cada proveedor. Conversión aproximada: 1 USD = $4.000 COP.

| Herramienta | Precio publicado | En COP aprox. |
|---|---|---|
| Toornament | Plan gratis; mejora por torneo desde USD 22 | $88.000 |
| Tournify | USD 45 por torneo | $180.000 |
| R2 Sports (30 equipos, 2 categorías) | USD 30 + USD 5 por equipo + USD 2 por categoría | $736.000 |
| TorneoPro | USD 7 a 15 al mes | $28.000 a $60.000 al mes |
| LeagueRepublic | USD 17,90 al mes | $72.000 al mes |

**Lectura:** por torneo, $100.000 a $150.000 queda en la zona de lo que ya se paga afuera. Lo que no encontré son precios de competidores en Colombia: eso se valida hablando con organizadores.

## Cómo entrar a competir

| Lo gratis suele dar | Lo que tú vendes además |
|---|---|
| Llaves y tabla de posiciones | Marcador punto a punto desde el celular del juez |
| Resultados que alguien digita al final | Quién saca y orden de saque |
| Una página para consultar | Pantalla o TV en cancha, con voz, sincronizada con el celular |
| | El público siguiendo el partido en vivo por un enlace |
| | Inscripciones, abonos, gastos y utilidad del torneo |

**La frase de venta:** "Tu torneo se ve profesional y sabes cuánto te queda, sin planillas ni discusiones por el marcador".

No digas que nadie más lo hace: algunas plataformas ya ofrecen resultados en vivo y hay apps sueltas de marcador. Tu ventaja es tenerlo **todo junto, en español y por un precio pensado para torneos locales**.

## Precios sugeridos

| Plan | Para quién | Precio |
|---|---|---|
| **Gratis** | Hasta 8 equipos (2 torneos por cuenta) | $0 |
| **Pequeño** | 9 a 16 equipos | $70.000 por torneo |
| **Mediano** | 17 a 32 equipos | $150.000 por torneo |
| **Grande** | 33 equipos o más | $250.000 por torneo |
| **Mensual** | Quien organiza varios torneos seguidos | $129.900 al mes |

- **Deja el marcador en el plan gratis.** Es lo que más sorprende y lo que hace vender el plan pago. El tope de 8 equipos ya limita el uso.
- **Cobra precio fijo, no porcentaje.** Es más fácil de vender y mantiene la promesa de "sin comisiones por venta".
- **Cobra antes de publicar.** La app ya funciona así.
- **El precio incluye software y soporte remoto.** Tú no operas ni vas a la cancha; si algún día lo haces, es un servicio aparte.

## Qué pedirle a Fase 4 a cambio del descuento

1. Un testimonio corto, en video o por escrito.
2. Permiso para usar su logo y fotos como caso de éxito.
3. Un video del marcador en cancha, para mostrárselo a otros organizadores.
4. Una conversación al terminar: qué sobró y qué faltó.

## Antes de vender: tres cosas por resolver

1. **Precios en cero:** hoy todos los escalones de torneo están en $0. Defínelos en `/superadmin/settings`.
2. **La suscripción actual es demasiado barata para esto:** los $59.900 al mes también cubren torneos, así que un torneo de 30 equipos saldría más barato que el plan Mediano. Súbela o sepárala de la de rifas.
3. **El marcador debe estar estable en producción:** DC Sport es una beta (v0.1.0), guarda en un archivo y permite 1 pantalla y 2 controles por partido. La integración necesita `DC_SPORT_SCORE_URL`, que no está en `.env.local`: confirma que esté configurada en producción y pruébalo con varios partidos a la vez antes de cobrar por eso.

## Próximos pasos

1. Cerrar Fase 4 en $100.000, pagados antes de publicar.
2. Grabar el marcador funcionando durante el torneo.
3. Hablar con 3 a 5 organizadores de Garzón y mostrarles el video.
4. Ofrecerles los precios de arriba y ajustar: si nadie objeta, están bajos; si todos dicen que no, están altos o falta valor.

## Fuentes

- [Toornament: comparador de precios](https://toolradar.com/tools/toornament/pricing) · [Anuncio de planes](https://blog.toornament.com/?p=10475)
- [Tournify y otros: Geekchamp](https://geekchamp.com/?p=248023)
- [R2 Sports: voleibol de playa](https://www.r2sports.com/cart/files/84/Sand-Volleyball-Tournament-Software.asp)
- [TorneoPro: ToolMage](https://www.toolmage.com/es/tool/torneopro/)
- [LeagueRepublic: GetApp](https://www.getapp.com/recreation-wellness-software/a/leaguerepublic/)
- [LeagueAppLive: Capterra](https://www.capterra.co.uk/software/177780/leagueapplive)
