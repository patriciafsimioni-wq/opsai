import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const FUEL_HEADERS = [
  "Transaction Date",
  "Transaction Time",
  "Post Date",
  "NAME",
  "DX NUMBER",
  "Card Number",
  "Trans ID",
  "Emboss Line 2",
  "ADDRESS",
  "Units",
  "Unit of Measure",
  "STATE",
  "Total Fuel Cost",
  "Service Cost",
  "Other Cost",
  "DATE",
  "Gross Cost",
  "Exempt Tax",
  "TIME",
  "COST",
  "GALLONS",
  "Transaction Fee Type 1",
  "Transaction Fee Amount 1",
  "Transaction Fee Type 2",
  "Transaction Fee Amount 2",
  "Transaction Fee Type 3",
  "Transaction Fee Amount 3",
  "Transaction Fee Type 4",
  "Transaction Fee Amount 4",
  "Transaction Fee Type 5",
  "Transaction Fee Amount 5",
  "Product",
  "Product Description",
  "Transaction Description",
  "Merchant (Brand)",
  "Merchant Name",
  "Merchant Address",
  "Merchant City",
  "STATION",
  "Merchant Postal Code",
  "Merchant Site ID",
  "Current Odometer",
  "Adjusted Odometer",
  "Previous Odometer",
  "Distance Driven",
  "Fuel Economy",
  "Cost Per Distance",
  "Vehicle Description",
  "VIN",
  "Tank Capacity",
  "Price Per Gallon",
];

const SERVICE_HEADERS = [
  "Timestamp",
  "DX NUMBER OR License Plate",
  "VIN NUMBER - Mandatory",
  "Service Category",
  "Odometer - MANDATORY",
  "Service Provider",
  "Date",
  "Invoice #",
  "Material Cost",
  "Service Cost",
  "Total Cost",
  "Service Description",
  "Invoice Picture",
  "STATION",
  "Work Order Number if Approved - PO",
];

const FAREYE_HEADERS = [
  "Date",
  "Station",
  "Stops",
  "Pieces",
  "Routes",
  "SPORH",
  "GCA",
  "POP",
  "Miles",
  "Fuel",
  "Actions",
];

const FLEET_HEADERS = [
  "DX #",
  "Plate #",
  "VIN #",
  "Status",
  "Year",
  "Make",
  "Model",
  "Location",
  "Vehicle",
  "Leasing Company",
  "SAMSARA",
  "TOLL",
  "Current Mileage",
  "Onboarded",
  "Lease End Date",
  "Months left for Pay off",
  "Registration Month",
  "Sideline Status",
];

const LEASE_ENTERPRISE_HEADERS = [
  "VIN",
  "Unit #",
  "Year",
  "Make",
  "Model",
  "Lease Type",
  "Term",
  "Start Date",
  "End Date",
  "Months In Service",
  "Contract Mileage",
  "Delivered Price",
  "Dep Amt Per Month",
  "Lease Charge Per Month",
  "Total Rent Per Month",
  "Service Charge Per Month",
  "Current Book Value",
  "Excess Mileage Rate",
];

const LEASE_MIKE_ALBERT_HEADERS = [
  "VIN",
  "Client Unit",
  "Year",
  "Make",
  "Model",
  "Open End Cap Cost",
  "Open End Depr Rate",
  "Open End Net Book Value",
  "Current Market Value",
  "Lease Start Date",
  "Lease End Date",
  "Monthly Payment",
];

export async function GET() {
  const wb = XLSX.utils.book_new();

  // Fuel tab
  const fuelWs = XLSX.utils.aoa_to_sheet([FUEL_HEADERS]);
  XLSX.utils.book_append_sheet(wb, fuelWs, "Fuel Report");

  // Service History tab
  const svcWs = XLSX.utils.aoa_to_sheet([SERVICE_HEADERS]);
  XLSX.utils.book_append_sheet(wb, svcWs, "Service History");

  // FareEye Routes tab
  const feWs = XLSX.utils.aoa_to_sheet([FAREYE_HEADERS]);
  XLSX.utils.book_append_sheet(wb, feWs, "FareEye Routes");

  // Fleet List tab
  const fleetWs = XLSX.utils.aoa_to_sheet([FLEET_HEADERS]);
  XLSX.utils.book_append_sheet(wb, fleetWs, "Fleet List");

  // Lease - Enterprise tab
  const leaseEWs = XLSX.utils.aoa_to_sheet([LEASE_ENTERPRISE_HEADERS]);
  XLSX.utils.book_append_sheet(wb, leaseEWs, "Lease - Enterprise");

  // Lease - Mike Albert tab
  const leaseMAWs = XLSX.utils.aoa_to_sheet([LEASE_MIKE_ALBERT_HEADERS]);
  XLSX.utils.book_append_sheet(wb, leaseMAWs, "Lease - Mike Albert");

  const arrayBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const uint8 = new Uint8Array(arrayBuf);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=LiveFleetAI_Upload_Template.xlsx",
    },
  });
}
