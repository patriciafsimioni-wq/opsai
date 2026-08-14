import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { GeofencesClient } from "@/components/GeofencesClient";

export const dynamic = "force-dynamic";

export default async function GeofencesPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader title="Geofences" subtitle="Virtual boundaries for depots, customers, and restricted zones." />
      <GeofencesClient canManage={manage} />
    </div>
  );
}
