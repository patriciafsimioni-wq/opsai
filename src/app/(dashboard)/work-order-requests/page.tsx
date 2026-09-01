import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { WorkOrderRequestsClient } from "@/components/WorkOrderRequestsClient";

export const dynamic = "force-dynamic";

export default async function WorkOrderRequestsPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Work Order Requests"
        subtitle="Submit service requests for approval, or review pending requests."
      />
      <WorkOrderRequestsClient canManage={manage} />
    </div>
  );
}
