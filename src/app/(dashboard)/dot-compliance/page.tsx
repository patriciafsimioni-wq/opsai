import { PageHeader } from "@/components/ui";
import { DotComplianceClient } from "@/components/DotComplianceClient";

export const dynamic = "force-dynamic";

export default function DotCompliancePage() {
  return (
    <div>
      <PageHeader
        title="DOT Compliance"
        subtitle="DOT driver-file status for Box Truck and Tractor Truck drivers."
        flagCategory="Drivers"
      />
      <DotComplianceClient />
    </div>
  );
}
