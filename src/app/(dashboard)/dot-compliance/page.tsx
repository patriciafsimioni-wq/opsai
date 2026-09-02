import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DotComplianceClient } from "@/components/DotComplianceClient";

export const dynamic = "force-dynamic";

export default async function DotCompliancePage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="DOT Compliance"
        subtitle="DOT driver-file status for Box Truck and Tractor Truck drivers."
        flagCategory="Drivers"
      />
      <DotComplianceClient canManage={manage} />
    </div>
  );
}
