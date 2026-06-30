import { PageHeader } from "@/components/ui";
import { ServiceCostsClient } from "@/components/ServiceCostsClient";

export const dynamic = "force-dynamic";

export default function ServiceCostsPage() {
  return (
    <div>
      <PageHeader
        title="Service Costs"
        subtitle="Cost per service, per month, and per station — material + labor."
      />
      <ServiceCostsClient />
    </div>
  );
}
