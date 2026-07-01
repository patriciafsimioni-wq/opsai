import { prisma } from "@/lib/db";
import { getSession, canManage } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { OffboardingClient } from "@/components/OffboardingClient";

export const dynamic = "force-dynamic";

export default async function OffboardingPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canManage(user.role)) redirect("/");

  // Get active vehicles available to start offboarding
  const activeVehicles = await prisma.vehicle.findMany({
    where: { status: { in: ["ACTIVE", "IDLE", "MAINTENANCE"] }, offboardStatus: null },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      year: true,
      make: true,
      model: true,
      odometer: true,
      station: true,
      branding: true,
      leasingCompany: true,
      leaseEndDate: true,
      monthsLeftPayoff: true,
      monthlyPayment: true,
      totalRentPerMonth: true,
      paidOff: true,
    },
    orderBy: { dxNumber: "asc" },
  });

  // Get vehicles in offboarding process
  const inProgress = await prisma.vehicle.findMany({
    where: { offboardStatus: "IN_PROGRESS" },
    include: {
      maintenance: { where: { status: "COMPLETED" }, select: { cost: true } },
      fuelLogs: { select: { totalCost: true } },
    },
    orderBy: { offboardedDate: "desc" },
  });

  // Get completed offboards
  const completed = await prisma.vehicle.findMany({
    where: { offboardStatus: "COMPLETED" },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      year: true,
      make: true,
      model: true,
      offboardReason: true,
      offboardMileage: true,
      offboardSoldAmount: true,
      offboardedDate: true,
      offboardPickupDate: true,
      station: true,
    },
    orderBy: { offboardedDate: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Vehicle Offboarding"
        subtitle="Manage vehicle offboarding process — track each step from initiation to pickup/sale."
      />
      <OffboardingClient
        activeVehicles={activeVehicles}
        inProgress={inProgress.map((v) => ({
          ...v,
          totalInvestment:
            v.maintenance.reduce((s, w) => s + w.cost, 0) +
            v.fuelLogs.reduce((s, f) => s + f.totalCost, 0) +
            ((v.monthlyPayment ?? v.totalRentPerMonth ?? 0) * (v.monthsInService ?? 0)),
        }))}
        completed={completed}
      />
    </div>
  );
}
