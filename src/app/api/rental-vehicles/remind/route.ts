import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { sendEmail, buildRentalInvoiceReminderEmail, getAppUrl } from "@/lib/email";
import { STATION_LABEL } from "@/lib/constants";

// Send every station manager a reminder to report any rental vehicles they
// have at their station and upload the invoices immediately. It's a blanket
// prompt (not tied to existing records). Only managers/admins can trigger it.
export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const stationManagers = await prisma.user.findMany({
    where: { role: "STATION_MANAGER" },
    select: { id: true, name: true, email: true, station: true },
  });

  const appUrl = getAppUrl();
  let sent = 0;
  const failedTo: string[] = [];

  for (const mgr of stationManagers) {
    if (!mgr.email) continue;

    const mgrStations = (mgr.station ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const stationLabel = mgrStations
      .map((s) => STATION_LABEL[s]?.split(" — ")[0] ?? s)
      .join(", ");

    const email = buildRentalInvoiceReminderEmail({
      managerName: mgr.name || "there",
      stationLabel,
      appUrl,
    });
    try {
      const res = await sendEmail({ to: mgr.email, ...email });
      if (res.success) sent += 1;
      else failedTo.push(mgr.email);
    } catch {
      failedTo.push(mgr.email);
    }
  }

  await logActivity(auth.user, {
    action: "sent",
    entity: "Rental Reminder",
    entityLabel: `${sent} station manager${sent === 1 ? "" : "s"} reminded`,
  });

  return NextResponse.json({
    sent,
    totalManagers: stationManagers.length,
    failed: failedTo.length,
  });
}
