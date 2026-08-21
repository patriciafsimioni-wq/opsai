import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ServicesClient } from "@/components/ServicesClient";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Service Catalog"
        subtitle="Preventive and corrective services with default material and labor costs."
      />
      <ServicesClient canManage={manage} />
    </div>
  );
}
