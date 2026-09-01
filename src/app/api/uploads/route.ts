import { NextResponse } from "next/server";
import { requireApiUser, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { attachmentUrl } from "@/lib/attachment";

// Serverless request bodies are capped (~4.5 MB on Vercel); keep uploads under
// that so the multipart POST isn't rejected before it reaches this handler.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return badRequest("No file uploaded");
  if (file.size > MAX_BYTES) return badRequest("File is too large — please use an image under 4 MB");
  if (!ALLOWED.includes(file.type)) return badRequest("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());
  // Files live in their own table and are referenced by URL, so the records
  // that point at them stay small enough to list without shipping megabytes.
  const saved = await prisma.attachment.create({
    data: {
      mimeType: file.type,
      filename: file.name || null,
      size: buffer.byteLength,
      data: buffer.toString("base64"),
    },
    select: { id: true },
  });

  return NextResponse.json({ url: attachmentUrl(saved.id, file.type) }, { status: 201 });
}
