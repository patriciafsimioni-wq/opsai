import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, stationWhere } from "@/lib/api";
import { canManage } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// Slim, server-filtered feed for the TROVA Vendor Payments page. The generic
// /api/maintenance endpoint returns every work order with its full vehicle
// record (tens of MB); here we return only completed, vendor-attached work
// orders with the handful of fields the page needs.
export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  if (!canManage(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sw = stationWhere(auth.user);
  const where: Prisma.WorkOrderWhereInput = {
    status: "COMPLETED",
    OR: [{ vendor: { not: null } }, { assignedToId: { not: null } }],
  };
  if (sw) where.AND = [{ OR: [{ vehicle: { is: sw } }, sw] }];

  const orders = await prisma.workOrder.findMany({
    where,
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      title: true,
      station: true,
      vendor: true,
      laborCost: true,
      poNumber: true,
      invoiceNumber: true,
      completedAt: true,
      createdAt: true,
      vendorPaid: true,
      vendorPaidAt: true,
      vendorPaymentMethod: true,
      vendorPaymentRef: true,
      vehicleOther: true,
      assignedTo: { select: { name: true } },
      vehicle: { select: { dxNumber: true, name: true } },
    },
  });

  return NextResponse.json(orders);
}
