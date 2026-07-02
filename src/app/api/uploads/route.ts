import { NextResponse } from "next/server";
import { requireApiUser, badRequest } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return badRequest("No file uploaded");
  if (file.size > MAX_BYTES) return badRequest("File exceeds the 5 MB limit");
  if (!ALLOWED.includes(file.type)) return badRequest("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  return NextResponse.json({ url: dataUrl }, { status: 201 });
}
