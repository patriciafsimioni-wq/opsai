import { PageHeader } from "@/components/ui";
import { FareyeRoutesClient } from "@/components/FareyeRoutesClient";

export const dynamic = "force-dynamic";

export default function FareyeRoutesPage() {
  return (
    <div>
      <PageHeader
        title="FareEye Routes"
        subtitle="Planned routes — mileage, stops, and vehicle utilization by day."
        flagCategory="FareEye Routes"
      />
      <FareyeRoutesClient />
    </div>
  );
}
