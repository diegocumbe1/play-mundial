/**
 * Preparación de imágenes en el navegador ANTES de subirlas.
 *
 * Una foto de celular pesa 3–8 MB y no cabe en el body de una Server Action
 * (tope configurado en `next.config.ts`); además, para el flyer y la página
 * pública no sirve de nada más resolución que la que se va a pintar. Aquí se
 * reduce el lado mayor y se recomprime a JPEG.
 *
 * Nunca lanza: si el navegador no puede decodificar el archivo (HEIC, formatos
 * raros), devuelve el original y que decida el servidor.
 */

/** Lado máximo del archivo que se sube (alcanza para el flyer 1080×1920). */
const LADO_MAX = 1600;
/** Por debajo de esto no vale la pena recomprimir. */
const PESO_OK = 900_000;

export async function prepararImagen(
  file: File,
  { ladoMax = LADO_MAX, pesoOk = PESO_OK }: { ladoMax?: number; pesoOk?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Los GIF pueden ser animados: recomprimirlos los dejaría en un solo cuadro.
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size <= pesoOk) {
      bitmap.close();
      return file;
    }

    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // Fondo blanco: al pasar a JPEG, lo transparente quedaría negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${nombre}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
