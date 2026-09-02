import { prisma } from "@/lib/db";
import { extractDxNumber, getSamsaraOdometerHistory, metersToMiles } from "@/lib/samsara";

/** A vehicle can't plausibly cover more than this in a day; a bigger jump
 *  between two readings means one of them was mis-keyed, so it's dropped. */
export const MAX_MILES_PER_DAY = 700;
/** Readings below this are placeholders/typos ("0", "1"), never real odometers. */
const MIN_PLAUSIBLE_MILES = 100;
const DAY_MS = 86_400_000;

export const SOURCE_SAMSARA = "SAMSARA";
export const SOURCE_FUEL = "FUEL";
export const SOURCE_DVIR = "DVIR";
export const SOURCE_WORK_ORDER = "WORK_ORDER";

export type Reading = { readAt: Date; miles: number; source: string };

export type Bucket = { key: string; label: string; start: Date; end: Date };

/** Monday-based week start, in UTC. */
export function weekStart(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

/** The `count` consecutive weeks or months ending with the one containing `ref`. */
export function buildBuckets(range: "week" | "month", count: number, ref: Date): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (range === "week") {
      const start = weekStart(new Date(ref.getTime() - i * 7 * DAY_MS));
      const end = new Date(start.getTime() + 7 * DAY_MS);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        start,
        end,
      });
    } else {
      const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      buckets.push({
        key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
        label: start.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        start,
        end,
      });
    }
  }
  return buckets;
}

export type MileageResult = {
  /** Miles per bucket, same order/length as the buckets passed in. */
  perBucket: number[];
  /** Miles credited across the whole span covered by the buckets. */
  total: number;
  /** Readings rejected as impossible (odometer went backwards or jumped). */
  rejected: number;
  /** True when the only readings available were hand-keyed and too
   *  contradictory to trust, so no miles are credited. */
  unreliable: boolean;
  firstReadAt: Date | null;
  lastReadAt: Date | null;
  lastMiles: number | null;
};

/** Miles driven per bucket, derived from the deltas between consecutive
 *  odometer readings of one vehicle.
 *
 *  Readings are dirty in practice (drivers key the odometer at the pump), so a
 *  delta only counts when it's non-negative and within MAX_MILES_PER_DAY of the
 *  elapsed time. A rejected reading is skipped without moving the baseline;
 *  two rejects in a row mean the baseline itself was wrong, so it resets to the
 *  newest reading without crediting miles. Each accepted delta is spread over
 *  the days between the two readings so a fill-up straddling a month boundary
 *  doesn't dump a whole month's miles into one bucket.
 *
 *  Telemetry wins when present: mixing Samsara's OBD odometer with pump-entered
 *  numbers for the same vehicle would double-count the offset between them.
 *
 *  Pump-entered odometers are frequently pure noise (a shared card, a guessed
 *  number, another van's odometer). When more hand-keyed deltas are rejected
 *  than accepted for a vehicle, the sequence carries no signal, so the vehicle
 *  reports no miles instead of the miles that the few upward jumps imply. */
export function computeMileage(readings: Reading[], buckets: Bucket[]): MileageResult {
  const perBucket = new Array(buckets.length).fill(0);
  const empty: MileageResult = {
    perBucket,
    total: 0,
    rejected: 0,
    unreliable: false,
    firstReadAt: null,
    lastReadAt: null,
    lastMiles: null,
  };
  const usable = readings.filter((r) => r.miles >= MIN_PLAUSIBLE_MILES);
  if (usable.length === 0) return empty;

  const telemetry = usable.filter((r) => r.source === SOURCE_SAMSARA);
  const isTelemetry = telemetry.length >= 2;
  const use = isTelemetry ? telemetry : usable;
  const sorted = [...use].sort((a, b) => a.readAt.getTime() - b.readAt.getTime());

  let base = sorted[0];
  let rejected = 0;
  let accepted = 0;
  let consecutiveRejects = 0;
  let total = 0;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const delta = cur.miles - base.miles;
    const days = Math.max(0.5, (cur.readAt.getTime() - base.readAt.getTime()) / DAY_MS);
    if (delta < 0 || delta > MAX_MILES_PER_DAY * days) {
      rejected++;
      consecutiveRejects++;
      if (consecutiveRejects >= 2) {
        base = cur;
        consecutiveRejects = 0;
      }
      continue;
    }
    consecutiveRejects = 0;
    accepted++;
    if (delta > 0) {
      total += delta;
      spread(perBucket, buckets, base.readAt, cur.readAt, delta);
    }
    base = cur;
  }

  if (!isTelemetry && rejected > accepted) {
    return { ...empty, perBucket: new Array(buckets.length).fill(0), rejected, unreliable: true };
  }

  return {
    perBucket,
    total,
    rejected,
    unreliable: false,
    firstReadAt: sorted[0].readAt,
    lastReadAt: sorted[sorted.length - 1].readAt,
    lastMiles: sorted[sorted.length - 1].miles,
  };
}

/** Credit `miles` to each bucket in proportion to its overlap with [from, to]. */
function spread(perBucket: number[], buckets: Bucket[], from: Date, to: Date, miles: number) {
  const span = Math.max(1, to.getTime() - from.getTime());
  buckets.forEach((b, i) => {
    const overlap =
      Math.min(to.getTime(), b.end.getTime()) - Math.max(from.getTime(), b.start.getTime());
    if (overlap > 0) perBucket[i] += (miles * overlap) / span;
  });
}

/** Copies odometers already captured elsewhere in the portal (fuel logs,
 *  DVIRs, completed work orders) into the reading history. Idempotent: each
 *  source row maps to one reading, so re-running only picks up new rows. */
export async function ingestExistingOdometers(since?: Date) {
  const dateFilter = since ? { gte: since } : undefined;

  const [fuel, dvir, wos] = await Promise.all([
    prisma.fuelLog.findMany({
      where: { vehicleId: { not: null }, odometer: { gte: MIN_PLAUSIBLE_MILES }, ...(dateFilter ? { date: dateFilter } : {}) },
      select: { id: true, vehicleId: true, date: true, odometer: true },
    }),
    prisma.dvirReport.findMany({
      where: { odometer: { gte: MIN_PLAUSIBLE_MILES }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { id: true, vehicleId: true, createdAt: true, odometer: true },
    }),
    prisma.workOrder.findMany({
      where: { vehicleId: { not: null }, odometerAt: { gte: MIN_PLAUSIBLE_MILES }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { id: true, vehicleId: true, createdAt: true, completedAt: true, odometerAt: true },
    }),
  ]);

  const rows = [
    ...fuel.map((f) => ({
      vehicleId: f.vehicleId!,
      readAt: f.date,
      miles: f.odometer!,
      source: SOURCE_FUEL,
      sourceId: f.id,
    })),
    ...dvir.map((d) => ({
      vehicleId: d.vehicleId,
      readAt: d.createdAt,
      miles: d.odometer!,
      source: SOURCE_DVIR,
      sourceId: d.id,
    })),
    ...wos.map((w) => ({
      vehicleId: w.vehicleId!,
      readAt: w.completedAt ?? w.createdAt,
      miles: w.odometerAt!,
      source: SOURCE_WORK_ORDER,
      sourceId: w.id,
    })),
  ];

  let added = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await prisma.odometerReading.createMany({
      data: rows.slice(i, i + 1000),
      skipDuplicates: true,
    });
    added += res.count;
  }
  return { scanned: rows.length, added };
}

/** Resolves a Samsara vehicle (its id, or its name when the id was never
 *  linked) to a portal vehicle id, the same way the Samsara vehicle sync does:
 *  stored Samsara id first, then DX number, plate, then name. */
export async function buildSamsaraVehicleMatcher() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, name: true, dxNumber: true, licensePlate: true, samsaraId: true },
  });
  const flatten = (s?: string | null) => s?.toUpperCase().replace(/\s+/g, "") || undefined;
  const bySamsaraId = new Map(vehicles.filter((v) => v.samsaraId).map((v) => [v.samsaraId!, v.id]));
  const byDx = new Map(vehicles.filter((v) => v.dxNumber).map((v) => [v.dxNumber!.toUpperCase(), v.id]));
  const byPlate = new Map(vehicles.map((v) => [flatten(v.licensePlate), v.id]));
  const byName = new Map(vehicles.map((v) => [flatten(v.name), v.id]));

  return (samsaraId: string, name?: string): string | undefined => {
    const flat = flatten(name);
    const dx = name ? extractDxNumber(name) : null;
    return (
      bySamsaraId.get(samsaraId) ??
      (dx ? byDx.get(dx) : undefined) ??
      (flat ? byPlate.get(flat) : undefined) ??
      (flat ? byName.get(flat) : undefined)
    );
  };
}

/** Pulls real historical odometer readings from Samsara (it keeps roughly 90
 *  days) and stores the last reading of each day per vehicle — enough
 *  resolution for weekly/monthly mileage without storing a reading every 30s.
 *  Fetches one day at a time to keep each response small. */
export async function backfillTelemetryHistory(start: Date, end: Date) {
  const matchVehicle = await buildSamsaraVehicleMatcher();
  let added = 0;
  let days = 0;
  let unmatched = 0;

  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
    const dayStart = new Date(t);
    const dayEnd = new Date(Math.min(t + DAY_MS, end.getTime()));
    const history = await getSamsaraOdometerHistory(dayStart, dayEnd);
    const entries: { vehicleId: string; miles: number; readAt: Date }[] = [];
    for (const v of history) {
      const vehicleId = matchVehicle(v.id, v.name);
      if (!vehicleId) {
        unmatched++;
        continue;
      }
      const series = v.obdOdometerMeters?.length ? v.obdOdometerMeters : v.gpsOdometerMeters;
      const last = series?.[series.length - 1];
      if (!last?.value) continue;
      entries.push({
        vehicleId,
        miles: metersToMiles(last.value),
        readAt: new Date(last.time),
      });
    }
    const res = await snapshotTelemetryReadings(entries);
    added += res.added;
    days++;
  }
  return { added, days, unmatched };
}

/** Stores one telemetry reading per vehicle per day (`sourceId` is the day),
 *  so re-running the snapshot in a day overwrites nothing and adds nothing. */
export async function snapshotTelemetryReadings(
  entries: { vehicleId: string; miles: number; readAt: Date }[],
) {
  const rows = entries
    .filter((e) => e.miles >= MIN_PLAUSIBLE_MILES)
    .map((e) => ({
      vehicleId: e.vehicleId,
      readAt: e.readAt,
      miles: e.miles,
      source: SOURCE_SAMSARA,
      sourceId: e.readAt.toISOString().slice(0, 10),
    }));
  if (rows.length === 0) return { added: 0 };
  const res = await prisma.odometerReading.createMany({ data: rows, skipDuplicates: true });
  return { added: res.count };
}
