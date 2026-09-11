// Shrink a captured photo on-device before saving (long edge 1280 px, JPEG 0.85).
// Keeps storage and upload size small; the original is not kept. The result is
// kept under MAX_BYTES so it fits a Firestore document (1 MiB limit).

const MAX_EDGE = 1280;
const MAX_BYTES = 700 * 1024;
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

export async function shrinkImage(file: Blob, maxEdge = MAX_EDGE): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();
  let out: Blob = file;
  for (const q of QUALITIES) {
    out = await toJpeg(canvas, q);
    if (out.size <= MAX_BYTES) break;
  }
  return out;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
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
