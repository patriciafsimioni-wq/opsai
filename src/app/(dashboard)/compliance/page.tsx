import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ComplianceAuditClient } from "@/components/ComplianceAuditClient";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "VENDOR") redirect("/");

  // Active fleet only — off-boarded/in-process vehicles are excluded from the audit.
  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { offboardStatus: null },
        { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      licensePlate: true,
      station: true,
      registrationExpiry: true,
      insuranceExpiry: true,
    },
    orderBy: { dxNumber: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Compliance Audit"
        subtitle="Registration & Insurance — expiry status across the active fleet."
      />
      <ComplianceAuditClient
        vehicles={vehicles.map((v) => ({
          id: v.id,
          name: v.name,
          dxNumber: v.dxNumber,
          licensePlate: v.licensePlate,
          station: v.station,
          registrationExpiry: v.registrationExpiry?.toISOString() ?? null,
          insuranceExpiry: v.insuranceExpiry?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
