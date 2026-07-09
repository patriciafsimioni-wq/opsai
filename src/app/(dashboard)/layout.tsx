import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, getUserStationFilter } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { GuidedTour } from "@/components/GuidedTour";
import { Heartbeat } from "@/components/Heartbeat";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  // "View as" role switcher for admins
  const cookieStore = await cookies();
  const viewAsRoleCookie = cookieStore.get("viewAsRole")?.value || null;
  const isRealAdmin = user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || user.role === "FLEET_MANAGER";
  const effectiveRole = (isRealAdmin && viewAsRoleCookie) ? viewAsRoleCookie : user.role;

  const userStations = getUserStationFilter(user);
  const alertWhere: Record<string, unknown> = { read: false, type: { notIn: ["SPEEDING", "HARSH_DRIVING"] } };
  if (userStations !== null) alertWhere.vehicle = { station: { in: userStations } };
  const alertCount = await prisma.alert.count({ where: alertWhere });
  const messageCount = await prisma.userMessage
    .count({ where: { recipientId: user.id, read: false } })
    .catch(() => 0);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar alertCount={alertCount} messageCount={messageCount} userRole={effectiveRole} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={{ name: user.name, email: user.email, role: user.role, station: user.station }}
            alertCount={alertCount}
            messageCount={messageCount}
            viewAsRole={isRealAdmin ? viewAsRoleCookie : null}
          />
          <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
        </div>
      </div>
      <GuidedTour />
      <Heartbeat />
    </SidebarProvider>
  );
}
