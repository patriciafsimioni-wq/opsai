// Uploaded files are stored as base64 `data:` URLs. Chrome blocks opening a
// `data:` URL as a top-level tab navigation (it just shows a blank page), so we
// convert to a Blob and open an object (`blob:`) URL instead, which is allowed.
export function openAttachment(url: string, filename?: string) {
  if (!url) return;
  if (!url.startsWith("data:")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const comma = url.indexOf(",");
    const meta = url.slice(5, comma); // strip "data:"
    const data = url.slice(comma + 1);
    const mime = meta.split(";")[0] || "application/octet-stream";
    const isBase64 = /;base64/i.test(meta);

    let ab: ArrayBuffer;
    if (isBase64) {
      const bin = atob(data);
      ab = new ArrayBuffer(bin.length);
      const view = new Uint8Array(ab);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    } else {
      const text = decodeURIComponent(data);
      ab = new ArrayBuffer(text.length);
      const view = new Uint8Array(ab);
      for (let i = 0; i < text.length; i++) view[i] = text.charCodeAt(i) & 0xff;
    }

    const blob = new Blob([ab], { type: mime });
    const objUrl = URL.createObjectURL(blob);
    const win = window.open(objUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — fall back to a download.
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Give the new tab time to load before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
