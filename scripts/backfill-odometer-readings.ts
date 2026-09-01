/**
 * Builds the odometer history the mileage report reads:
 *  - real per-day telematics readings from Samsara (it retains ~90 days)
 *  - odometers already captured on fuel logs, DVIRs and completed work orders
 *
 * Idempotent — re-running only adds readings that aren't stored yet.
 *
 * Run: npx tsx scripts/backfill-odometer-readings.ts [days]
 */
import { backfillTelemetryHistory, ingestExistingOdometers } from "../src/lib/mileage";
import { isConfigured } from "../src/lib/samsara";
import { prisma } from "../src/lib/db";

const DAY_MS = 86_400_000;

async function main() {
  const days = Number(process.argv[2] ?? 95);

  const records = await ingestExistingOdometers();
  console.log(`Records: scanned ${records.scanned}, added ${records.added} readings.`);

  if (isConfigured()) {
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY_MS);
    const tel = await backfillTelemetryHistory(start, end);
    console.log(
      `Samsara: ${tel.days} days scanned, added ${tel.added} readings, ${tel.unmatched} unmatched vehicle-days.`,
    );
  } else {
    console.log("Samsara not configured — skipped telemetry backfill.");
  }

  const bySource = await prisma.odometerReading.groupBy({ by: ["source"], _count: true });
  console.log(`Total readings: ${await prisma.odometerReading.count()}`);
  for (const s of bySource) console.log(`  ${s.source}: ${s._count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
