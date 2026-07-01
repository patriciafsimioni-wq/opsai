import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "GENERAL_MANAGER" && user.role !== "FLEET_MANAGER" && user.role !== "MANAGER") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      station: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <UsersClient users={users} currentRole={user.role} />;
}
