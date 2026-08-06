import { prisma } from "@/lib/db";
import { SafetyClient } from "@/components/SafetyClient";

export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const alerts = await prisma.alert.findMany({
    where: { type: { in: ["SPEEDING", "HARSH_DRIVING"] } },
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, driver: true },
  });

  const data = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    message: a.message,
    read: a.read,
    createdAt: a.createdAt.toISOString(),
    vehicleId: a.vehicleId,
    vehicleName: a.vehicle?.name || a.vehicle?.dxNumber || null,
    driverId: a.driverId,
    driverName: a.driver ? `${a.driver.firstName} ${a.driver.lastName}` : null,
  }));

  return <SafetyClient alerts={data} />;
}
