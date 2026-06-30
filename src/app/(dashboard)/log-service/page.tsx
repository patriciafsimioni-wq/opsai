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
        subtitle="Record a service performed on a vehicle — material cost and labor (hours × rate)."
      />
      <LogServiceClient canManage={manage} performerName={user?.name ?? ""} />
    </div>
  );
}
