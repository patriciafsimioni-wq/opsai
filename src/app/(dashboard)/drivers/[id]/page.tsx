import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Truck, Phone, Mail, Flag } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Avatar, Table, Th, Td } from "@/components/ui";
import { DRIVER_STATUS, TRIP_STATUS } from "@/lib/constants";
import { formatDate, daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await prisma.driver.findUnique({
    where: { id },
    include: {
      vehicles: true,
      trips: { orderBy: { scheduledStart: "desc" }, take: 10, include: { vehicle: true } },
    },
  });
  if (!d) notFound();

  const status = DRIVER_STATUS[d.status as keyof typeof DRIVER_STATUS];
  const exp = daysUntil(d.licenseExpiry);

  return (
    <div>
      <Link href="/drivers" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Back to drivers
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${d.firstName} ${d.lastName}`} color={d.avatarColor} size={56} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {d.firstName} {d.lastName}
              </h1>
              <Badge bg={status.bg} fg={status.fg}>
                {status.label}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--color-muted)]">
              <span className="inline-flex items-center gap-1">
                <Mail size={14} /> {d.email}
              </span>
              {d.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={14} /> {d.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <a
          href={`/issues?create=1&title=${encodeURIComponent(`Driver Issue — ${d.firstName} ${d.lastName}`)}&category=Drivers&description=${encodeURIComponent(`Driver: ${d.firstName} ${d.lastName} · ${d.email}`)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
        >
          <Flag size={14} /> Flag Issue
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-400">Safety Score</p>
          <p
            className="mt-1 text-xl font-bold"
            style={{ color: d.safetyScore >= 85 ? "#16a34a" : d.safetyScore >= 70 ? "#d97706" : "#dc2626" }}
          >
            {d.safetyScore}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400">Trips</p>
          <p className="mt-1 text-xl font-bold">{d.trips.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400">Hire Date</p>
          <p className="mt-1 text-lg font-bold">{formatDate(d.hireDate)}</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="License" />
          <dl className="divide-y divide-[var(--color-border)] text-sm">
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-slate-400">Number</dt>
              <dd className="font-medium">{d.licenseNumber}</dd>
            </div>
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-slate-400">Class</dt>
              <dd className="font-medium">{d.licenseClass ?? "—"}</dd>
            </div>
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-slate-400">Expiry</dt>
              <dd className="font-medium">
                {formatDate(d.licenseExpiry)}
                {exp != null && (
                  <span className={"ml-2 text-xs " + (exp < 0 ? "text-red-500" : exp < 30 ? "text-amber-600" : "text-slate-400")}>
                    {exp < 0 ? "Expired" : `${exp}d`}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Assigned Vehicles" />
          {d.vehicles.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No vehicles assigned.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {d.vehicles.map((v) => (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Truck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-slate-400">{v.make} {v.model}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Performance" />
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span className="text-slate-600">
                {d.safetyScore >= 85 ? "Excellent safety record" : d.safetyScore >= 70 ? "Good standing" : "Needs improvement"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Safety score combines harsh-braking, speeding and idling telemetry.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader title="Recent Trips" />
          {d.trips.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No trips.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Route</Th>
                  <Th>Vehicle</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Distance</Th>
                </tr>
              </thead>
              <tbody>
                {d.trips.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.origin} → {t.destination}</Td>
                    <Td className="text-slate-600">{t.vehicle.name}</Td>
                    <Td>
                      <Badge
                        bg={TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].bg}
                        fg={TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].fg}
                      >
                        {TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].label}
                      </Badge>
                    </Td>
                    <Td className="text-slate-600">{formatDate(t.scheduledStart)}</Td>
                    <Td>{Math.round(t.distanceKm)} mi</Td>
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
