import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession, canManage } from "@/lib/auth";
import { MessagesClient } from "@/components/MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader title="Messages" subtitle="Send and reply to messages with your team." />
      <MessagesClient currentUserId={user.id} canManage={canManage(user.role)} />
    </div>
  );
}
