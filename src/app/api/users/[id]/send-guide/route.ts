import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { sendEmail, buildGuideEmail, getAppUrl } from "@/lib/email";

// Send the getting-started / guide email to a single user. Does NOT touch
// the user's password (unlike resend-invite).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const guide = buildGuideEmail({
    name: user.name,
    role: user.role,
    appUrl: getAppUrl(),
  });

  const result = await sendEmail({ to: user.email, ...guide });

  return NextResponse.json({
    success: true,
    emailSent: result.success,
    emailError: result.error ?? null,
  });
}
