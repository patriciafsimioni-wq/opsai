import { NextResponse } from "next/server";
import { requireManager } from "@/lib/api";
import { getSamsaraVehicleStats, metersToMiles, isConfigured } from "@/lib/samsara";
import {
  buildSamsaraVehicleMatcher,
  ingestExistingOdometers,
  snapshotTelemetryReadings,
} from "@/lib/mileage";

/** Records today's telematics odometer for every matched vehicle and pulls in
 *  any odometers newly captured on fuel logs, DVIRs and work orders, building
 *  the history the mileage report reads. Safe to run repeatedly. */
async function syncOdometerHistory() {
  const ingested = await ingestExistingOdometers();

  let telemetry = { added: 0 };
  let samsaraMatched = 0;
  if (isConfigured()) {
    const matchVehicle = await buildSamsaraVehicleMatcher();
    const stats = await getSamsaraVehicleStats();
    const entries: { vehicleId: string; miles: number; readAt: Date }[] = [];
    for (const s of stats) {
      const vehicleId = matchVehicle(s.id, s.name);
      if (!vehicleId) continue;
      const reading = s.obdOdometerMeters ?? s.gpsOdometerMeters;
      if (!reading?.value) continue;
      samsaraMatched++;
      entries.push({
        vehicleId,
        miles: metersToMiles(reading.value),
        readAt: new Date(reading.time),
      });
    }
    telemetry = await snapshotTelemetryReadings(entries);
  }

  return {
    readingsFromRecords: ingested.added,
    recordsScanned: ingested.scanned,
    telemetryReadings: telemetry.added,
    samsaraMatched,
  };
}

export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await syncOdometerHistory());
}

// Cron-friendly GET (Vercel Cron sends GET requests), same as the nightly
// compliance alert job.
export async function GET() {
  return NextResponse.json(await syncOdometerHistory());
}
