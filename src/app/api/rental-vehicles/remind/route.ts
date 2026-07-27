import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { sendEmail, buildRentalInvoiceReminderEmail, getAppUrl } from "@/lib/email";
import { STATION_LABEL } from "@/lib/constants";

type ReminderRental = {
  vehicleName: string;
  rentalCompany: string | null;
  pickupDate: string | null;
  hasInvoice: boolean;
};

function hasUploadedInvoice(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((i) => {
      if (typeof i === "string") return Boolean(i);
      const o = i as { url?: unknown };
      return typeof o.url === "string" && o.url.length > 0;
    });
  } catch {
    return false;
  }
}

// Send each station manager a reminder to upload the invoice for their
// station's current (active) rental vehicle(s) — or the latest one if none is
// active. Only managers/admins can trigger it.
export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const rentals = await prisma.rentalVehicle
    .findMany({ orderBy: { pickupDate: "desc" } })
    .catch(() => []);

  const toEntry = (r: (typeof rentals)[number]): ReminderRental => ({
    vehicleName: r.vehicleName,
    rentalCompany: r.rentalCompany,
    pickupDate: r.pickupDate ? r.pickupDate.toISOString() : null,
    hasInvoice: hasUploadedInvoice(r.invoices),
  });

  // The "reminder" rentals per station: all active rentals if the station has
  // any, otherwise its single latest rental (rentals are sorted newest-first).
  const reminderByStation = new Map<string, ReminderRental[]>();
  for (const r of rentals) {
    if (!r.station || r.status !== "ACTIVE") continue;
    const list = reminderByStation.get(r.station) ?? [];
    list.push(toEntry(r));
    reminderByStation.set(r.station, list);
  }
  for (const r of rentals) {
    if (!r.station || reminderByStation.has(r.station)) continue;
    reminderByStation.set(r.station, [toEntry(r)]);
  }

  const stationManagers = await prisma.user.findMany({
    where: { role: "STATION_MANAGER" },
    select: { id: true, name: true, email: true, station: true },
  });

  const appUrl = getAppUrl();
  let sent = 0;
  const failedTo: string[] = [];
  const stationsCovered = new Set<string>();

  for (const mgr of stationManagers) {
    if (!mgr.email) continue;
    const mgrStations = (mgr.station ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rentalsForMgr: ReminderRental[] = [];
    for (const st of mgrStations) {
      const list = reminderByStation.get(st);
      if (list) rentalsForMgr.push(...list);
    }
    if (rentalsForMgr.length === 0) continue;

    const stationLabel = mgrStations
      .map((s) => STATION_LABEL[s]?.split(" — ")[0] ?? s)
      .join(", ");
    const email = buildRentalInvoiceReminderEmail({
      managerName: mgr.name || "there",
      stationLabel,
      rentals: rentalsForMgr,
      appUrl,
    });
    try {
      const res = await sendEmail({ to: mgr.email, ...email });
      if (res.success) {
        sent += 1;
        mgrStations.forEach((s) => stationsCovered.add(s));
      } else {
        failedTo.push(mgr.email);
      }
    } catch {
      failedTo.push(mgr.email);
    }
  }

  const stationsWithRentals = [...reminderByStation.keys()];
  const stationsWithoutManager = stationsWithRentals.filter((s) => !stationsCovered.has(s));

  await logActivity(auth.user, {
    action: "sent",
    entity: "Rental Reminder",
    entityLabel: `${sent} station manager${sent === 1 ? "" : "s"} reminded`,
    detail: stationsWithRentals.join(", ") || undefined,
  });

  return NextResponse.json({
    sent,
    stationsWithRentals: stationsWithRentals.length,
    stationsWithoutManager,
    failed: failedTo.length,
  });
}
