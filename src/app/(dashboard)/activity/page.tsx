import { prisma } from "@/lib/db";
import { getSession, getUserStationFilter, isStationScoped } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActivityClient } from "@/components/ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Service roles (mechanic/vendor/driver) don't get the audit log.
  const allowed = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "DATA_ENTRY"];
  if (!allowed.includes(user.role)) redirect("/");

  const stations = getUserStationFilter(user);
  const where = stations && stations.length > 0 ? { station: { in: stations } } : {};

  const rows = await prisma.activityLog
    .findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 })
    .catch(() => []);

  return <ActivityClient rows={rows} showStationFilter={!isStationScoped(user.role)} />;
}
