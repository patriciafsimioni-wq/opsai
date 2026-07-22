import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { getSamsaraDrivers, isConfigured } from "@/lib/samsara";

export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SAMSARA_API_KEY not configured" },
      { status: 500 },
    );
  }

  const samsaraDrivers = await getSamsaraDrivers();
  const existingDrivers = await prisma.driver.findMany({
    select: { id: true, firstName: true, lastName: true, samsaraId: true },
  });

  // Build lookup by samsaraId and by name
  const bySamsaraId = new Map(
    existingDrivers.filter((d) => d.samsaraId).map((d) => [d.samsaraId!, d]),
  );
  const byFullName = new Map(
    existingDrivers.map((d) => [`${d.firstName} ${d.lastName}`.toUpperCase(), d]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const sd of samsaraDrivers) {
    if (sd.driverActivationStatus !== "active") {
      skipped++;
      continue;
    }

    const nameParts = sd.name.trim().split(/\s+/);
    const firstName = nameParts[0]
      ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase()
      : "Unknown";
    const lastName = nameParts.slice(1).map((n) =>
      n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
    ).join(" ") || "Driver";

    // Determine station from tags
    const tagName = sd.tags?.[0]?.name ?? "";
    const stationMap: Record<string, string> = {
      Houston: "IAH",
      Austin: "AUS",
      Harlingen: "HRL",
      Laredo: "LRD",
      Temple: "ACT",
      "College Station": "CLL",
      Beaumont: "BPT",
    };
    const station = stationMap[tagName] || "IAH";

    // Try to match existing driver
    let existing = bySamsaraId.get(sd.id);
    if (!existing) {
      existing = byFullName.get(`${firstName} ${lastName}`.toUpperCase());
    }

    if (existing) {
      await prisma.driver.update({
        where: { id: existing.id },
        data: { samsaraId: sd.id, station },
      });
      updated++;
    } else {
      await prisma.driver.create({
        data: {
          firstName,
          lastName,
          email: `${sd.username || firstName.toLowerCase()}@synctx.com`,
          phone: sd.phone || "",
          licenseNumber: "",
          licenseExpiry: new Date("2027-12-31"),
          status: "ACTIVE",
          station,
          samsaraId: sd.id,
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    samsaraDrivers: samsaraDrivers.length,
    created,
    updated,
    skipped,
  });
}
