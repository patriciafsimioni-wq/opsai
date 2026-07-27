// Client-side image compression for invoice/photo uploads.
//
// Phone photos (especially from iPhones) are routinely 3–10 MB, which exceeds
// Vercel's ~4.5 MB serverless request-body cap — the upload is rejected before
// it ever reaches our handler, surfacing as a generic "upload failed". We
// downscale + re-encode images in the browser so the POST stays well under the
// limit. Non-image files (e.g. PDFs) and already-small images pass through.

const MAX_DIMENSION = 2000; // px on the longest edge
const TARGET_BYTES = 3 * 1024 * 1024; // aim comfortably under the 4.5 MB cap
const MIN_QUALITY = 0.5;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export async function compressImage(file: File): Promise<File> {
  // Only compress raster images the browser can decode. PDFs and anything
  // already small enough are returned untouched.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= TARGET_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.8;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }
    if (!blob) return file;
    // If compression somehow produced a larger file, keep the original.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // If anything goes wrong decoding/encoding, fall back to the original file
    // and let the server enforce its limits.
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
