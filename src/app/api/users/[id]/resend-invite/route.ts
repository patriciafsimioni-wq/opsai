import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { sendEmail, buildInviteEmail, getAppUrl } from "@/lib/email";

// Generate a readable temporary password (no ambiguous chars like 0/O, 1/l).
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Resend the welcome/invite email. The original password can't be recovered
// (only a one-way hash is stored), so this resets the account to a fresh
// temporary password and emails the full welcome with the new credentials.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword) },
  });

  const invite = buildInviteEmail({
    name: user.name,
    email: user.email,
    password: tempPassword,
    role: user.role,
    stations: user.station || null,
    appUrl: getAppUrl(),
  });

  const result = await sendEmail({ to: user.email, ...invite });

  return NextResponse.json({
    success: true,
    emailSent: result.success,
    emailError: result.error ?? null,
    tempPassword,
  });
}
