import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserAdmin } from "@/lib/api";
import { sendEmail, buildGuideEmail, getAppUrl } from "@/lib/email";

// Send the getting-started / guide email to every user. Does NOT touch any
// passwords. Sends sequentially so one failure doesn't abort the rest.
export async function POST() {
  const auth = await requireUserAdmin();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    select: { name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const appUrl = getAppUrl();
  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const user of users) {
    const guide = buildGuideEmail({ name: user.name, role: user.role, appUrl });
    const result = await sendEmail({ to: user.email, ...guide });
    if (result.success) sent++;
    else failed.push({ email: user.email, error: result.error ?? "Unknown error" });
  }

  return NextResponse.json({ success: true, total: users.length, sent, failed });
}
