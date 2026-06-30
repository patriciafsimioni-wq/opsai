import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireApiUser, badRequest } from "@/lib/api";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return badRequest("No file uploaded");
  if (file.size > MAX_BYTES) return badRequest("File exceeds the 10 MB limit");
  if (!ALLOWED.includes(file.type)) return badRequest("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".png");
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}
