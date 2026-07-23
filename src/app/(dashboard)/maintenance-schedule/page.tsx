import { PageHeader } from "@/components/ui";
import { MaintenanceScheduleClient } from "@/components/MaintenanceScheduleClient";

export const dynamic = "force-dynamic";

export default function MaintenanceSchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance Schedule" />
      <MaintenanceScheduleClient />
    </div>
  );
}
