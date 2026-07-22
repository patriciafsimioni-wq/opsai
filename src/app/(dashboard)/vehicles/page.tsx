import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { VehiclesClient } from "@/components/VehiclesClient";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Manage your fleet's vehicles, status, and assignments."
        flagCategory="Vehicles"
      />
      <VehiclesClient canManage={manage} />
    </div>
  );
}
