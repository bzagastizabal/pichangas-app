// Comprime/redimensiona una imagen en el navegador antes de subirla.
// Reduce el peso (WebP, lado máx ~1280px) para no ocupar espacio en el host.
export async function comprimirImagen(
  file: File,
  maxLado = 1280,
  calidad = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', calidad),
  );
  return blob ?? file;
}
