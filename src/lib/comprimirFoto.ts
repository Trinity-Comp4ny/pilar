/**
 * Comprime a foto no aparelho (máx. 1600 px, JPEG 0,8): essencial para subir em 4G ruim de
 * canteiro. Devolve o Blob, que a fila offline guarda (o base64 só nasce na hora de enviar).
 */
export async function comprimirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  if (!blob) throw new Error("não deu para comprimir a foto");
  return blob;
}
