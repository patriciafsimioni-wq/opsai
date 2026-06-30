import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UploadsClient } from "@/components/UploadsClient";

export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Smart Upload"
        subtitle="Upload Excel, CSV, or PDF files — AI auto-classifies them into the correct data category."
      />
      <UploadsClient canManage={manage} />
    </div>
  );
}
