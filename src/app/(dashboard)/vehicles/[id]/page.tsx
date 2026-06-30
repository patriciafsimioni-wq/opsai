import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Fuel,
  Calendar,
  ShieldCheck,
  MapPin,
  User,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Table, Th, Td, ProgressBar } from "@/components/ui";
import {
  VEHICLE_STATUS,
  WO_STATUS,
  PRIORITY,
  titleCase,
} from "@/lib/constants";
import {
  formatNumber,
  formatDate,
  formatCurrency,
  relativeTime,
  daysUntil,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      assignedDriver: true,
      maintenance: { orderBy: { createdAt: "desc" } },
      fuelLogs: { orderBy: { date: "desc" }, take: 10 },
      trips: { orderBy: { scheduledStart: "desc" }, take: 8, include: { driver: true } },
    },
  });
  if (!v) notFound();

  const status = VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS];
  const totalFuelCost = v.fuelLogs.reduce((s, f) => s + f.totalCost, 0);
  const totalMaintCost = v.maintenance
    .filter((w) => w.status === "COMPLETED")
    .reduce((s, w) => s + w.cost, 0);
  const regDays = daysUntil(v.registrationExpiry);
  const insDays = daysUntil(v.insuranceExpiry);

  return (
    <div>
      <Link
        href="/vehicles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back to vehicles
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{v.name}</h1>
            <Badge bg={status.bg} fg={status.fg}>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {v.year} {v.make} {v.model} · {titleCase(v.type)} · {v.licensePlate}
            {v.dxNumber ? ` · ${v.dxNumber}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Gauge size={14} /> Odometer
          </div>
          <p className="mt-1 text-xl font-bold">{formatNumber(v.odometer)} km</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Fuel size={14} /> Fuel Level
          </div>
          <p className="mt-1 text-xl font-bold">{Math.round(v.fuelLevel)}%</p>
          <div className="mt-2">
            <ProgressBar value={v.fuelLevel} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin size={14} /> Last Seen
          </div>
          <p className="mt-1 text-xl font-bold">{relativeTime(v.lastSeen)}</p>
          <p className="text-xs text-slate-400">
            {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User size={14} /> Driver
          </div>
          <p className="mt-1 text-lg font-bold">
            {v.assignedDriver
              ? `${v.assignedDriver.firstName} ${v.assignedDriver.lastName}`
              : "Unassigned"}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Specifications" />
          <dl className="divide-y divide-[var(--color-border)] text-sm">
            {([
              ["VIN", v.vin],
              ["DX #", v.dxNumber ?? "—"],
              ["Fuel type", titleCase(v.fuelType)],
              ["Tank capacity", `${v.tankCapacity} L`],
              ["Leasing Company", v.leasingCompany ?? "—"],
              ["Samsara ID", v.samsaraId ?? "—"],
              ["Onboarded", v.onboardedDate ? formatDate(v.onboardedDate) : "—"],
              ["Lease End", v.leaseEndDate ? formatDate(v.leaseEndDate) : "—"],
              ["Registration Month", v.registrationMonth ?? "—"],
            ] as [string, string][]).map(([k, val]) => (
              <div key={k} className="flex justify-between px-5 py-2.5">
                <dt className="text-slate-400">{k}</dt>
                <dd className="font-medium">{val}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Compliance" subtitle="Document status" />
          <div className="space-y-3 p-5">
            <ComplianceRow
              label="Registration"
              date={v.registrationExpiry}
              days={regDays}
            />
            <ComplianceRow
              label="Insurance"
              date={v.insuranceExpiry}
              days={insDays}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Lifetime Costs" />
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs text-slate-400">Fuel (recent)</p>
              <p className="text-xl font-bold">{formatCurrency(totalFuelCost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Maintenance (completed)</p>
              <p className="text-xl font-bold">{formatCurrency(totalMaintCost)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Maintenance History" />
          {v.maintenance.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No records.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Work Order</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {v.maintenance.map((w) => (
                  <tr key={w.id}>
                    <Td>
                      <p className="font-medium">{w.title}</p>
                      <p className="text-xs text-slate-400">{titleCase(w.type)}</p>
                    </Td>
                    <Td>
                      <Badge
                        bg={WO_STATUS[w.status as keyof typeof WO_STATUS].bg}
                        fg={WO_STATUS[w.status as keyof typeof WO_STATUS].fg}
                      >
                        {WO_STATUS[w.status as keyof typeof WO_STATUS].label}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        bg={PRIORITY[w.priority as keyof typeof PRIORITY].bg}
                        fg={PRIORITY[w.priority as keyof typeof PRIORITY].fg}
                      >
                        {PRIORITY[w.priority as keyof typeof PRIORITY].label}
                      </Badge>
                    </Td>
                    <Td>{formatCurrency(w.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Trips" />
          {v.trips.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No trips.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Route</Th>
                  <Th>Driver</Th>
                  <Th>Date</Th>
                  <Th>Distance</Th>
                </tr>
              </thead>
              <tbody>
                {v.trips.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      {t.origin} → {t.destination}
                    </Td>
                    <Td className="text-slate-600">
                      {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "—"}
                    </Td>
                    <Td className="text-slate-600">{formatDate(t.scheduledStart)}</Td>
                    <Td>{Math.round(t.distanceKm)} km</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function ComplianceRow({
  label,
  date,
  days,
}: {
  label: string;
  date: Date | null;
  days: number | null;
}) {
  const expired = days != null && days < 0;
  const soon = days != null && days >= 0 && days < 30;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {expired ? (
          <Calendar size={16} className="text-red-500" />
        ) : (
          <ShieldCheck size={16} className={soon ? "text-amber-500" : "text-emerald-500"} />
        )}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatDate(date)}</p>
        {days != null && (
          <p
            className={
              "text-xs " +
              (expired ? "text-red-500" : soon ? "text-amber-600" : "text-slate-400")
            }
          >
            {expired ? `Expired ${-days}d ago` : `${days}d remaining`}
          </p>
        )}
      </div>
    </div>
  );
}
