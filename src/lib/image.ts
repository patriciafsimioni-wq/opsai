// Client-side image downscaling so uploaded photos are stored small (they are
// embedded as base64 in the record). PDFs and non-images pass through unchanged.
export async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 600 * 1024) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.(png|webp|jpeg|jpg)$/i, "") + ".jpg", { type: "image/jpeg" });
}
