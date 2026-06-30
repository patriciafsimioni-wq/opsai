import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TripsClient } from "@/components/TripsClient";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader title="Trips & Dispatch" subtitle="Plan, dispatch, and track deliveries." />
      <TripsClient canManage={manage} />
    </div>
  );
}
