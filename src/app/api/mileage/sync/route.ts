import { NextRequest, NextResponse } from "next/server";
import { requireManager, isCronAuthorized } from "@/lib/api";
import { getSamsaraVehicleStats, metersToMiles, isConfigured } from "@/lib/samsara";
import {
  backfillTelemetryHistory,
  buildSamsaraVehicleMatcher,
  ingestExistingOdometers,
  snapshotTelemetryReadings,
} from "@/lib/mileage";


export const maxDuration = 300;
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
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncOdometerHistory();
  // `?backfillDays=N` re-pulls Samsara's daily history for the last N days,
  // filling gaps left when the nightly job did not run.
  const backfillDays = Number(req.nextUrl.searchParams.get("backfillDays") ?? 0);
  if (isConfigured() && backfillDays > 0 && backfillDays <= 90) {
    const end = new Date();
    const start = new Date(end.getTime() - backfillDays * 24 * 60 * 60 * 1000);
    return NextResponse.json({ ...result, backfill: await backfillTelemetryHistory(start, end) });
  }
  return NextResponse.json(result);
}
