import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MaintenanceClient } from "@/components/MaintenanceClient";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Work orders, service schedules, and repair costs." />
      <MaintenanceClient canManage={manage} />
    </div>
  );
}
