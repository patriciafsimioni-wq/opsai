import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const FILE = "/home/ubuntu/attachments/323d3637-22bd-4e74-a8cc-2ec796750aa1/LiveFleetAI_Upload_Template-5.xlsx";

const xd = (n) => (n == null ? null : new Date(Math.round((Number(n) - 25569) * 86400 * 1000)));
const numOrNull = (v) => (v == null || v === "" ? null : Number(v));

const wb = XLSX.readFile(FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Lease - Mike Albert"], { defval: null }).filter((r) => r["VIN"]);

let created = 0, updated = 0;
for (const r of rows) {
  const vin = String(r["VIN"]).toUpperCase().trim();
  const plate = String(r["License Plate Number"]).trim();
  const model = String(r["Vehicle Model"] || "").trim();
  const isVan = /transit/i.test(model);

  const data = {
    name: plate,
    licensePlate: plate,
    dxNumber: r["Unit #"] ? String(r["Unit #"]).trim() : null,
    make: String(r["Make"] || "").trim(),
    model,
    year: parseInt(r["Year"]) || 0,
    type: isVan ? "VAN" : "TRUCK",
    fuelType: isVan ? "ELECTRIC" : "DIESEL",
    status: "ACTIVE",
    lifecycleStatus: "ACTIVE",
    station: "AUS",
    leasingCompany: "Mike Albert",
    leaseType: "OPEN_END",
    leaseStartDate: xd(r["Contract Start Date"]),
    leaseEndDate: xd(r["Contract End Date"]),
    leaseTerm: parseInt(r["Term in Months"]) || null,
    monthsInService: parseInt(r["Months In Service"]) || null,
    contractMileage: numOrNull(r["Permitted Mileage"]),
    leaseChargePerMonth: numOrNull(r["Base Lease Rate"]),
    totalRentPerMonth: numOrNull(r["Base Lease Rate"]),
    serviceChargePerMonth: numOrNull(r["Services Amount"]),
    deliveredPrice: numOrNull(r["Initial Fair Market Value"]),
    openEndCapCost: numOrNull(r["Open End Cap Cost"]),
    openEndDeprRate: numOrNull(r["Open End Depr Rate"]),
    openEndNetBookValue: numOrNull(r["Open End Net Book Value"]),
    currentMarketValue: numOrNull(r["Current Market Value Open End Contracts and Owned Units"]),
    currentBookValue: numOrNull(r["Open End Net Book Value"]),
    excessMileageRate: numOrNull(r["Excess Mileage Rate"]),
    odometer: numOrNull(r["In Service Miles"]) || 0,
    registrationExpiry: xd(r["License Plate Expiration Date"]),
    paidOff: false,
  };

  const existing = await prisma.vehicle.findUnique({ where: { vin } });
  if (existing) {
    await prisma.vehicle.update({ where: { vin }, data });
    updated++;
    console.log("updated", plate, vin);
  } else {
    await prisma.vehicle.create({ data: { ...data, vin } });
    created++;
    console.log("created", plate, vin);
  }
}
console.log(`\nDone. created=${created} updated=${updated}`);
await prisma.$disconnect();
