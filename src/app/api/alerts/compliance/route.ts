import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, isCronAuthorized } from "@/lib/api";
import { generateComplianceAlerts } from "@/lib/compliance-alerts";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const result = await generateComplianceAlerts();
  return NextResponse.json(result);
}

// Cron-friendly GET (Vercel Cron sends GET requests).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await generateComplianceAlerts();
  return NextResponse.json(result);
}
