import { redirect } from "next/navigation";
import { getSession, getUserStationFilter } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const userStations = getUserStationFilter(user);
  const alertWhere: Record<string, unknown> = { read: false, type: { notIn: ["SPEEDING", "HARSH_DRIVING"] } };
  if (userStations) alertWhere.vehicle = { station: { in: userStations } };
  const alertCount = await prisma.alert.count({ where: alertWhere });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar alertCount={alertCount} userRole={user.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={{ name: user.name, email: user.email, role: user.role, station: user.station }}
            alertCount={alertCount}
          />
          <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
