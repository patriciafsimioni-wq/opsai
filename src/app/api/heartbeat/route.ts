import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Lightweight presence ping: the dashboard calls this on load and periodically
// so we can show "last active" / online status on the Users page.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  await prisma.user
    .update({ where: { id: session.id }, data: { lastActiveAt: new Date() } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
