import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

/** Streams one uploaded file. Records reference their files by this URL rather
 *  than embedding the bytes, so lists stay small and the browser fetches a
 *  document only when it is actually opened. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  // URLs carry a file extension (`/api/attachments/<id>.jpg`) so the UI can
  // tell an image from a PDF without loading it.
  const { id: slug } = await params;
  const id = slug.replace(/\.[a-z0-9]+$/i, "");
  const file = await prisma.attachment.findUnique({
    where: { id },
    select: { mimeType: true, filename: true, data: true },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(file.data, "base64");
  const name = (file.filename ?? `attachment-${id}`).replace(/["\\\r\n]/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${name}"`,
      // Contents never change, but they are per-user authorized.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
