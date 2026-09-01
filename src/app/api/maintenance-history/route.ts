import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, fleetGroupWhere, stationWhere } from "@/lib/api";
import { toCsv, type CsvColumn } from "@/lib/csv";

/** One exported line of maintenance history: a service line on a work order,
 *  or a repair recorded against a failed DVIR item. */
type Row = {
  vehicle: string;
  dxNumber: string;
  vin: string;
  station: string;
  fleet: string;
  date: Date | null;
  source: string;
  status: string;
  type: string;
  priority: string;
  workOrder: string;
  service: string;
  description: string;
  odometer: number | null;
  vendor: string;
  performedBy: string;
  requestedBy: string;
  poNumber: string;
  invoiceNumber: string;
  materialCost: number;
  laborCost: number;
  laborHours: number;
  laborRate: number;
  total: number;
  vendorPaid: string;
  vendorPaidAt: Date | null;
  scheduledFor: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  invoiceUrl: string;
};

const date = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const money = (n: number) => (n ? n.toFixed(2) : "0.00");
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Vehicle", value: (r) => r.vehicle },
  { header: "DX #", value: (r) => r.dxNumber },
  { header: "VIN", value: (r) => r.vin },
  { header: "Station", value: (r) => r.station },
  { header: "Fleet", value: (r) => r.fleet },
  { header: "Date", value: (r) => date(r.date) },
  { header: "Source", value: (r) => r.source },
  { header: "Status", value: (r) => r.status },
  { header: "Type", value: (r) => r.type },
  { header: "Priority", value: (r) => r.priority },
  { header: "Work Order", value: (r) => r.workOrder },
  { header: "Service", value: (r) => r.service },
  { header: "Description", value: (r) => r.description },
  { header: "Odometer", value: (r) => (r.odometer ? Math.round(r.odometer) : "") },
  { header: "Vendor", value: (r) => r.vendor },
  { header: "Performed By", value: (r) => r.performedBy },
  { header: "Requested By", value: (r) => r.requestedBy },
  { header: "PO #", value: (r) => r.poNumber },
  { header: "Invoice #", value: (r) => r.invoiceNumber },
  { header: "Material Cost", value: (r) => money(r.materialCost) },
  { header: "Labor Cost", value: (r) => money(r.laborCost) },
  { header: "Labor Hours", value: (r) => r.laborHours || "" },
  { header: "Labor Rate", value: (r) => (r.laborRate ? money(r.laborRate) : "") },
  { header: "Total Cost", value: (r) => money(r.total) },
  { header: "Vendor Paid", value: (r) => r.vendorPaid },
  { header: "Vendor Paid Date", value: (r) => date(r.vendorPaidAt) },
  { header: "Scheduled For", value: (r) => date(r.scheduledFor) },
  { header: "Completed", value: (r) => date(r.completedAt) },
  { header: "Logged", value: (r) => date(r.createdAt) },
  { header: "Invoice/Document", value: (r) => r.invoiceUrl },
];

/** Full maintenance history as CSV — one row per service performed, so a work
 *  order covering several services exports one line each with its own cost and
 *  description. Pass ?vehicleId= for a single vehicle, otherwise the whole
 *  (station- and fleet-scoped) fleet. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const vehicleId = sp.get("vehicleId") || "";
  const requestedStation = sp.get("station") || "";

  const sw = stationWhere(auth.user);
  const fg = await fleetGroupWhere();
  // A station-scoped user can narrow to one of their own stations, never past them.
  const stationFilter =
    requestedStation && (!sw || sw.station.in.includes(requestedStation as never))
      ? { station: requestedStation }
      : (sw ?? {});

  const vehicleWhere: Record<string, unknown> = {
    ...(vehicleId ? { id: vehicleId } : {}),
    ...stationFilter,
    ...(fg ? { fleetGroup: fg } : {}),
  };

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere,
    select: {
      id: true,
      name: true,
      dxNumber: true,
      vin: true,
      station: true,
      fleetGroup: true,
    },
  });
  if (vehicles.length === 0) {
    return NextResponse.json({ error: "No vehicles found" }, { status: 404 });
  }
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const vehicleIds = vehicles.map((v) => v.id);

  const [workOrders, dvirs] = await Promise.all([
    prisma.workOrder.findMany({
      where: { vehicleId: { in: vehicleIds } },
      include: { items: { orderBy: { createdAt: "asc" } }, service: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dvirReport.findMany({
      where: { vehicleId: { in: vehicleIds }, repairs: { some: {} } },
      select: { id: true, vehicleId: true, odometer: true, repairs: true },
    }),
  ]);

  const rows: Row[] = [];

  for (const w of workOrders) {
    const v = w.vehicleId ? byId.get(w.vehicleId) : undefined;
    if (!v) continue;
    const base = {
      vehicle: v.name,
      dxNumber: v.dxNumber ?? "",
      vin: w.vin ?? v.vin ?? "",
      station: v.station,
      fleet: v.fleetGroup === "TRACTOR_TRAILER" ? "Tractors & Trailers" : "Regular",
      date: w.completedAt ?? w.scheduledFor ?? w.createdAt,
      source: "Work Order",
      status: titleCase(w.status),
      type: titleCase(w.type),
      priority: titleCase(w.priority),
      workOrder: w.title,
      odometer: w.odometerAt ?? null,
      vendor: w.vendor ?? "",
      performedBy: w.performedBy ?? "",
      requestedBy: w.requestedBy ?? "",
      poNumber: w.poNumber ?? "",
      invoiceNumber: w.invoiceNumber ?? "",
      laborHours: w.laborHours,
      laborRate: w.laborRate,
      vendorPaid: w.vendorPaid ? "Yes" : "No",
      vendorPaidAt: w.vendorPaidAt,
      scheduledFor: w.scheduledFor,
      completedAt: w.completedAt,
      createdAt: w.createdAt,
      invoiceUrl: !w.invoiceUrl
        ? ""
        : w.invoiceUrl.startsWith("data:") || w.invoiceUrl.startsWith("/api/attachments/")
          ? "Attached"
          : w.invoiceUrl,
    };

    // A multi-service work order exports one row per service line so each
    // service's own cost and description survive the export; its parent totals
    // are the roll-up of those lines and would double-count.
    if (w.items.length > 0) {
      for (const it of w.items) {
        rows.push({
          ...base,
          service: it.title,
          description: it.description ?? w.description ?? "",
          materialCost: it.materialCost,
          laborCost: it.laborCost,
          total: it.materialCost + it.laborCost,
        });
      }
    } else {
      rows.push({
        ...base,
        service: w.service?.name ?? w.title,
        description: w.description ?? "",
        materialCost: w.materialCost,
        laborCost: w.laborCost,
        total: w.cost,
      });
    }
  }

  for (const d of dvirs) {
    const v = d.vehicleId ? byId.get(d.vehicleId) : undefined;
    if (!v) continue;
    for (const r of d.repairs) {
      rows.push({
        vehicle: v.name,
        dxNumber: v.dxNumber ?? "",
        vin: v.vin ?? "",
        station: v.station,
        fleet: v.fleetGroup === "TRACTOR_TRAILER" ? "Tractors & Trailers" : "Regular",
        date: r.fixedAt,
        source: "DVIR Repair",
        status: "Completed",
        type: "Repair",
        priority: "",
        workOrder: `DVIR — ${titleCase(r.item)}`,
        service: titleCase(r.item),
        description: r.description,
        odometer: d.odometer ?? null,
        vendor: r.vendor ?? "",
        performedBy: r.vendor ?? "",
        requestedBy: "",
        poNumber: "",
        invoiceNumber: r.invoiceNumber ?? "",
        materialCost: 0,
        laborCost: 0,
        laborHours: 0,
        laborRate: 0,
        total: r.cost,
        vendorPaid: "",
        vendorPaidAt: null,
        scheduledFor: null,
        completedAt: r.fixedAt,
        createdAt: r.createdAt,
        invoiceUrl: "",
      });
    }
  }

  rows.sort((a, b) => {
    if (a.vehicle !== b.vehicle) return a.vehicle.localeCompare(b.vehicle);
    return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
  });

  const single = vehicleId ? vehicles[0] : null;
  const name = single
    ? `maintenance-history-${(single.dxNumber || single.name).replace(/[^A-Za-z0-9-]+/g, "-")}`
    : "maintenance-history-fleet";

  return new NextResponse(toCsv(rows, COLUMNS), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
