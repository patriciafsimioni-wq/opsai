import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LogServiceClient } from "@/components/LogServiceClient";

export const dynamic = "force-dynamic";

export default async function LogServicePage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Log Service"
        subtitle="Record a maintenance / repair service order — material + service cost per vehicle."
      />
      <LogServiceClient canManage={manage} performerName={user?.name ?? ""} />
    </div>
  );
}
