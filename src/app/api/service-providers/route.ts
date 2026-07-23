import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const providers = await prisma.serviceProvider.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(providers);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const existing = await prisma.serviceProvider.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Provider already exists" }, { status: 409 });
  }
  const provider = await prisma.serviceProvider.create({ data: { name: name.trim() } });
  return NextResponse.json(provider, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }
  await prisma.serviceProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
