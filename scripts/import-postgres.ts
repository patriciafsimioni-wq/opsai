/**
 * Import exported SQLite data into PostgreSQL.
 * Run: DATABASE_URL="postgresql://..." npx tsx scripts/import-postgres.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const raw = JSON.parse(readFileSync("/home/ubuntu/sqlite-export.json", "utf-8"));
  console.log("Importing data into PostgreSQL...\n");

  // Services first (referenced by WorkOrders and WORequests)
  if (raw.services?.length) {
    console.log(`Importing ${raw.services.length} services...`);
    for (const s of raw.services) {
      await prisma.service.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          name: s.name,
          category: s.category,
          group: s.group,
          materialCost: s.materialCost ?? 0,
          laborCost: s.laborCost ?? 0,
          active: s.active ?? true,
          createdAt: toDate(s.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Users (no FK deps except driver which is optional)
  if (raw.users?.length) {
    console.log(`Importing ${raw.users.length} users...`);
    for (const u of raw.users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          passwordHash: u.passwordHash,
          role: u.role,
          station: u.station,
          createdAt: toDate(u.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Drivers
  if (raw.drivers?.length) {
    console.log(`Importing ${raw.drivers.length} drivers...`);
    for (const d of raw.drivers) {
      await prisma.driver.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone,
          licenseNumber: d.licenseNumber,
          licenseClass: d.licenseClass,
          licenseExpiry: toDate(d.licenseExpiry) ?? new Date(),
          status: d.status,
          hireDate: toDate(d.hireDate) ?? new Date(),
          rating: d.rating ?? 4.5,
          safetyScore: d.safetyScore ?? 85,
          avatarColor: d.avatarColor ?? "#2563eb",
          samsaraId: d.samsaraId,
          station: d.station,
          createdAt: toDate(d.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Link users to drivers
  if (raw.users?.length) {
    for (const u of raw.users) {
      if (u.driverId) {
        await prisma.user.update({
          where: { id: u.id },
          data: { driverId: u.driverId },
        });
      }
    }
  }

  // Vehicles
  if (raw.vehicles?.length) {
    console.log(`Importing ${raw.vehicles.length} vehicles...`);
    for (const v of raw.vehicles) {
      await prisma.vehicle.upsert({
        where: { id: v.id },
        update: {},
        create: {
          id: v.id,
          name: v.name,
          dxNumber: v.dxNumber,
          make: v.make,
          model: v.model,
          year: v.year,
          vin: v.vin,
          licensePlate: v.licensePlate,
          type: v.type,
          status: v.status,
          fuelType: v.fuelType,
          odometer: v.odometer ?? 0,
          fuelLevel: v.fuelLevel ?? 100,
          tankCapacity: v.tankCapacity ?? 200,
          station: v.station,
          leasingCompany: v.leasingCompany,
          leaseType: v.leaseType,
          leaseTerm: v.leaseTerm,
          leaseStartDate: toDate(v.leaseStartDate),
          leaseEndDate: toDate(v.leaseEndDate),
          monthsInService: v.monthsInService,
          contractMileage: v.contractMileage,
          deliveredPrice: v.deliveredPrice,
          depAmtPerMonth: v.depAmtPerMonth,
          leaseChargePerMonth: v.leaseChargePerMonth,
          totalRentPerMonth: v.totalRentPerMonth,
          serviceChargePerMonth: v.serviceChargePerMonth,
          currentBookValue: v.currentBookValue,
          excessMileageRate: v.excessMileageRate,
          openEndCapCost: v.openEndCapCost,
          openEndDeprRate: v.openEndDeprRate,
          openEndNetBookValue: v.openEndNetBookValue,
          currentMarketValue: v.currentMarketValue,
          monthsLeftPayoff: v.monthsLeftPayoff,
          paidOff: v.paidOff ?? false,
          branding: v.branding,
          offboardedDate: toDate(v.offboardedDate),
          offboardReason: v.offboardReason,
          offboardStatus: v.offboardStatus,
          offboardMileage: v.offboardMileage,
          offboardBrandingRemoved: v.offboardBrandingRemoved ?? false,
          offboardCameraRemoved: v.offboardCameraRemoved ?? false,
          offboardPickupRequested: v.offboardPickupRequested ?? false,
          offboardPickupDate: toDate(v.offboardPickupDate),
          offboardSoldAmount: v.offboardSoldAmount,
          onboardPhotos: v.onboardPhotos,
          samsaraId: v.samsaraId,
          hasSamsaraCamera: v.hasSamsaraCamera ?? false,
          onboardedDate: toDate(v.onboardedDate),
          registrationMonth: v.registrationMonth,
          registrationExpiry: toDate(v.registrationExpiry),
          insuranceExpiry: toDate(v.insuranceExpiry),
          purchaseDate: toDate(v.purchaseDate),
          purchasePrice: v.purchasePrice,
          lifecycleStatus: v.lifecycleStatus ?? "ACTIVE",
          taxesAndFees: v.taxesAndFees,
          brandingCost: v.brandingCost,
          gpsCamerasCost: v.gpsCamerasCost,
          upfittingCost: v.upfittingCost,
          registrationCost: v.registrationCost,
          initialInsurance: v.initialInsurance,
          monthlyPayment: v.monthlyPayment,
          allowedMileage: v.allowedMileage,
          residualValue: v.residualValue,
          purchaseOption: v.purchaseOption,
          earlyTermFee: v.earlyTermFee,
          lat: v.lat,
          lng: v.lng,
          heading: v.heading ?? 0,
          speed: v.speed ?? 0,
          engineOn: v.engineOn ?? false,
          lastSeen: toDate(v.lastSeen),
          assignedDriverId: v.assignedDriverId,
          createdAt: toDate(v.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Trips
  if (raw.trips?.length) {
    console.log(`Importing ${raw.trips.length} trips...`);
    for (const t of raw.trips) {
      await prisma.trip.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          vehicleId: t.vehicleId,
          driverId: t.driverId,
          origin: t.origin,
          destination: t.destination,
          originLat: t.originLat,
          originLng: t.originLng,
          destLat: t.destLat,
          destLng: t.destLng,
          status: t.status,
          scheduledStart: toDate(t.scheduledStart) ?? new Date(),
          startedAt: toDate(t.startedAt),
          endedAt: toDate(t.endedAt),
          distanceKm: t.distanceKm ?? 0,
          cargo: t.cargo,
          notes: t.notes,
          createdAt: toDate(t.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Work Orders
  if (raw.workOrders?.length) {
    console.log(`Importing ${raw.workOrders.length} work orders...`);
    for (const w of raw.workOrders) {
      await prisma.workOrder.upsert({
        where: { id: w.id },
        update: {},
        create: {
          id: w.id,
          vehicleId: w.vehicleId,
          serviceId: w.serviceId,
          station: w.station,
          type: w.type,
          title: w.title,
          description: w.description,
          status: w.status,
          priority: w.priority,
          materialCost: w.materialCost ?? 0,
          laborHours: w.laborHours ?? 0,
          laborRate: w.laborRate ?? 0,
          laborCost: w.laborCost ?? 0,
          cost: w.cost ?? 0,
          performedBy: w.performedBy,
          odometerAt: w.odometerAt,
          vendor: w.vendor,
          vin: w.vin,
          poNumber: w.poNumber,
          invoiceNumber: w.invoiceNumber,
          invoiceUrl: w.invoiceUrl,
          scheduledFor: toDate(w.scheduledFor),
          completedAt: toDate(w.completedAt),
          createdAt: toDate(w.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Maintenance Schedules
  if (raw.maintenanceSchedules?.length) {
    console.log(`Importing ${raw.maintenanceSchedules.length} maintenance schedules...`);
    for (const m of raw.maintenanceSchedules) {
      await prisma.maintenanceSchedule.upsert({
        where: { id: m.id },
        update: {},
        create: {
          id: m.id,
          vehicleId: m.vehicleId,
          taskName: m.taskName,
          intervalKm: m.intervalKm,
          intervalDays: m.intervalDays,
          lastServiceOdo: m.lastServiceOdo,
          lastServiceDate: toDate(m.lastServiceDate),
          nextDueOdo: m.nextDueOdo,
          nextDueDate: toDate(m.nextDueDate),
          createdAt: toDate(m.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Fuel Logs (batch insert for speed)
  if (raw.fuelLogs?.length) {
    console.log(`Importing ${raw.fuelLogs.length} fuel logs...`);
    const BATCH = 200;
    for (let i = 0; i < raw.fuelLogs.length; i += BATCH) {
      const batch = raw.fuelLogs.slice(i, i + BATCH);
      await prisma.fuelLog.createMany({
        data: batch.map((f: Record<string, unknown>) => ({
          id: f.id as string,
          vehicleId: f.vehicleId as string,
          driverId: f.driverId as string | null,
          driverName: f.driverName as string | null,
          date: toDate(f.date) ?? new Date(),
          liters: (f.liters ?? 0) as number,
          pricePerLiter: (f.pricePerLiter ?? 0) as number,
          totalCost: (f.totalCost ?? 0) as number,
          odometer: f.odometer as number | null,
          location: f.location as string | null,
          purchaseType: f.purchaseType as "UNLEADED" | "DIESEL" | "DEF" | "NON_FUEL",
          cardNumber: f.cardNumber as string | null,
          createdAt: toDate(f.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      process.stdout.write(`  ${Math.min(i + BATCH, raw.fuelLogs.length)}/${raw.fuelLogs.length}\r`);
    }
    console.log();
  }

  // Geofences
  if (raw.geofences?.length) {
    console.log(`Importing ${raw.geofences.length} geofences...`);
    for (const g of raw.geofences) {
      await prisma.geofence.upsert({
        where: { id: g.id },
        update: {},
        create: {
          id: g.id,
          name: g.name,
          type: g.type,
          centerLat: g.centerLat,
          centerLng: g.centerLng,
          radiusM: g.radiusM ?? 500,
          color: g.color ?? "#2563eb",
          createdAt: toDate(g.createdAt) ?? new Date(),
        },
      });
    }
  }

  // Alerts
  if (raw.alerts?.length) {
    console.log(`Importing ${raw.alerts.length} alerts...`);
    for (const a of raw.alerts) {
      await prisma.alert.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          type: a.type,
          severity: a.severity,
          message: a.message,
          vehicleId: a.vehicleId,
          driverId: a.driverId,
          read: a.read ?? false,
          resolvedAt: toDate(a.resolvedAt),
          createdAt: toDate(a.createdAt) ?? new Date(),
        },
      });
    }
  }

  // PM Budgets
  if (raw.pmBudgets?.length) {
    console.log(`Importing ${raw.pmBudgets.length} PM budgets...`);
    for (const b of raw.pmBudgets) {
      await prisma.pmBudget.upsert({
        where: { id: b.id },
        update: {},
        create: {
          id: b.id,
          year: b.year,
          month: b.month,
          station: b.station,
          category: b.category,
          amount: b.amount,
        },
      });
    }
  }

  // FareEye Routes (batch)
  if (raw.fareyeRoutes?.length) {
    console.log(`Importing ${raw.fareyeRoutes.length} FareEye routes...`);
    const BATCH = 200;
    for (let i = 0; i < raw.fareyeRoutes.length; i += BATCH) {
      const batch = raw.fareyeRoutes.slice(i, i + BATCH);
      await prisma.fareyeRoute.createMany({
        data: batch.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          date: toDate(r.date) ?? new Date(),
          routeId: r.routeId as string,
          miles: (r.miles ?? 0) as number,
          travelMinutes: (r.travelMinutes ?? 0) as number,
          routeDurationMinutes: (r.routeDurationMinutes ?? 0) as number,
          leaveByTime: r.leaveByTime as string | null,
          plannedEndTime: r.plannedEndTime as string | null,
          stops: (r.stops ?? 0) as number,
          totalWeight: (r.totalWeight ?? 0) as number,
          totalPallets: (r.totalPallets ?? 0) as number,
          vehicleType: r.vehicleType as string,
          vehicleTag: r.vehicleTag as string | null,
          vehicleUtilization: (r.vehicleUtilization ?? 0) as number,
          sporh: (r.sporh ?? 0) as number,
          plannedHours: (r.plannedHours ?? 0) as number,
          lat: r.lat as number | null,
          lng: r.lng as number | null,
          station: r.station as "AUS" | "ACT" | "IAH" | "CLL" | "BPT" | "HRL" | "LRD",
          createdAt: toDate(r.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      process.stdout.write(`  ${Math.min(i + BATCH, raw.fareyeRoutes.length)}/${raw.fareyeRoutes.length}\r`);
    }
    console.log();
  }

  // PM Alert Dismissals
  if (raw.pmAlertDismissals?.length) {
    console.log(`Importing ${raw.pmAlertDismissals.length} PM alert dismissals...`);
    for (const d of raw.pmAlertDismissals) {
      await prisma.pmAlertDismissal.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          vehicleId: d.vehicleId,
          service: d.service,
          action: d.action ?? "done",
          note: d.note,
          mileageAt: d.mileageAt,
          createdAt: toDate(d.createdAt) ?? new Date(),
        },
      });
    }
  }

  console.log("\nDone! All data imported to PostgreSQL.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
