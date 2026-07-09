import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth";
import { sendEmail, buildInviteEmail } from "@/lib/email";

export async function GET() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      station: true,
      createdAt: true,
      lastActiveAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MECHANIC", "VENDOR", "MANAGER", "DRIVER"]),
  station: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (existing) return badRequest("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      email: d.email.toLowerCase(),
      name: d.name,
      passwordHash: await hashPassword(d.password),
      role: d.role,
      station: d.station || null,
    },
  });

  // Send invite email (non-blocking — don't fail if email fails)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://opsai-opal.vercel.app";
  const invite = buildInviteEmail({
    name: d.name,
    email: d.email.toLowerCase(),
    password: d.password,
    role: d.role,
    stations: d.station || null,
    appUrl,
  });
  // Await the send: on Vercel the serverless function is frozen once the
  // response returns, so a fire-and-forget promise never completes and the
  // email is silently dropped. Wrapped so a send failure never breaks signup.
  try {
    await sendEmail({ to: d.email.toLowerCase(), ...invite });
  } catch {
    // ignore — user is still created even if the invite email fails
  }

  await logActivity(auth.user, {
    action: "created",
    entity: "User",
    entityLabel: `${user.name} (${user.email})`,
    station: user.station,
    detail: user.role,
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    station: user.station,
  }, { status: 201 });
}
