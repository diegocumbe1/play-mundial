/**
 * `fetch` con timeout y reintentos para llamadas a proveedores externos.
 *
 * Las APIs de fútbol fallan de forma intermitente a nivel de red (conexión
 * cortada, DNS lento, sin respuesta) y eso hace que Node lance `fetch failed`,
 * tumbando toda la sincronización. Aquí reintentamos esos fallos transitorios
 * con backoff exponencial y abortamos cada intento que tarde demasiado.
 */

interface OpcionesReintento {
  /** Nº máximo de intentos (incluido el primero). Default 3. */
  intentos?: number;
  /** Timeout por intento en ms. Default 8000. */
  timeoutMs?: number;
  /** Backoff base en ms (se duplica por intento). Default 500. */
  backoffMs?: number;
}

/** True si el status HTTP es transitorio y vale la pena reintentar. */
function esStatusReintentable(status: number): boolean {
  return status === 429 || status >= 500;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchConReintentos(
  url: URL | string,
  init: RequestInit,
  opciones: OpcionesReintento = {},
): Promise<Response> {
  const { intentos = 3, timeoutMs = 8_000, backoffMs = 500 } = opciones;

  let ultimoError: unknown;

  for (let intento = 1; intento <= intentos; intento++) {
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      // Errores transitorios del servidor: reintentar si quedan intentos.
      if (esStatusReintentable(res.status) && intento < intentos) {
        await espera(backoffMs * 2 ** (intento - 1));
        continue;
      }

      return res;
    } catch (err) {
      // Fallos de red ("fetch failed") o abort por timeout caen aquí.
      ultimoError = err;
      if (intento < intentos) {
        await espera(backoffMs * 2 ** (intento - 1));
        continue;
      }
    } finally {
      clearTimeout(temporizador);
    }
  }

  const detalle =
    ultimoError instanceof Error ? ultimoError.message : String(ultimoError);
  throw new Error(
    `No se pudo contactar al proveedor tras ${intentos} intentos: ${detalle}`,
  );
}
