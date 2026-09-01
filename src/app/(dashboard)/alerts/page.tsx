import { PageHeader } from "@/components/ui";
import { AlertsClient } from "@/components/AlertsClient";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader title="Alerts" subtitle="Safety, compliance, and operational notifications." />
      <AlertsClient />
    </div>
  );
}
