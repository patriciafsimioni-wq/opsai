import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MaintenanceClient } from "@/components/MaintenanceClient";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  const isVendor = user?.role === "VENDOR";
  return (
    <div>
      <PageHeader
        title={isVendor ? "My Work Orders" : "Maintenance"}
        subtitle={isVendor ? "Services assigned to you — mark them done when complete." : "Work orders, service schedules, and repair costs."}
        flagCategory="Maintenance"
      />
      <MaintenanceClient canManage={manage} isVendor={isVendor} performerName={user?.name ?? ""} />
    </div>
  );
}
