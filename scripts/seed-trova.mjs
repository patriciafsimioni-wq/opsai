import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const SYNCTX_URL = process.env.DATABASE_URL;
const TROVA_URL = process.env.TROVA_DATABASE_URL;
if (!SYNCTX_URL || !TROVA_URL) {
  console.error("Need DATABASE_URL (SYNCTX) and TROVA_DATABASE_URL set");
  process.exit(1);
}

const synctx = new PrismaClient({ datasources: { db: { url: SYNCTX_URL } } });
const trova = new PrismaClient({ datasources: { db: { url: TROVA_URL } } });

async function main() {
  // Copy the service catalog from SYNCTX so Log Service / finance grouping work.
  const services = await synctx.service.findMany();
  const existing = await trova.service.count();
  if (existing === 0) {
    for (const s of services) {
      await trova.service.create({
        data: {
          name: s.name,
          category: s.category,
          group: s.group,
          materialCost: s.materialCost,
          laborCost: s.laborCost,
          active: s.active,
        },
      });
    }
    console.log(`Copied ${services.length} services into TROVA`);
  } else {
    console.log(`TROVA already has ${existing} services, skipping catalog copy`);
  }

  // Base login users (empty fleet otherwise).
  const users = [
    { email: "admin@livefleet.ai", name: "Admin", role: "ADMIN", password: "admin123" },
    { email: "manager@livefleet.ai", name: "Manager", role: "MANAGER", password: "manager123" },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await trova.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }
  console.log("Ensured base users (admin@livefleet.ai / admin123, manager@livefleet.ai / manager123)");

  const counts = {
    vehicles: await trova.vehicle.count(),
    drivers: await trova.driver.count(),
    services: await trova.service.count(),
    users: await trova.user.count(),
  };
  console.log("TROVA counts:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await synctx.$disconnect();
    await trova.$disconnect();
  });
