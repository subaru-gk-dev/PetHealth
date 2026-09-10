// Shrink a captured photo on-device before saving (long edge 1280 px, JPEG 0.85).
// Keeps storage and upload size small; the original is not kept.

const MAX_EDGE = 1280;

export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85);
  });
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // imageOrientation applies EXIF rotation where supported.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
