export const VEHICLE_STATUS = {
  ACTIVE: { label: "Active", color: "#16a34a", bg: "#dcfce7", fg: "#166534" },
  IDLE: { label: "Idle", color: "#d97706", bg: "#fef3c7", fg: "#92400e" },
  MAINTENANCE: { label: "Maintenance", color: "#2563eb", bg: "#dbeafe", fg: "#1e40af" },
  OUT_OF_SERVICE: { label: "Out of Service", color: "#dc2626", bg: "#fee2e2", fg: "#991b1b" },
} as const;

export const VEHICLE_TYPES = ["TRUCK", "VAN", "CAR", "BUS", "PICKUP", "TRAILER"] as const;
export const VEHICLE_STATUSES = ["ACTIVE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE"] as const;
export const FUEL_TYPES = ["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"] as const;

export const DRIVER_STATUS = {
  ACTIVE: { label: "Active", bg: "#dcfce7", fg: "#166534" },
  ON_TRIP: { label: "On Trip", bg: "#dbeafe", fg: "#1e40af" },
  OFF_DUTY: { label: "Off Duty", bg: "#f1f5f9", fg: "#475569" },
  INACTIVE: { label: "Inactive", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const DRIVER_STATUSES = ["ACTIVE", "ON_TRIP", "OFF_DUTY", "INACTIVE"] as const;

export const TRIP_STATUS = {
  SCHEDULED: { label: "Scheduled", bg: "#f1f5f9", fg: "#475569" },
  IN_PROGRESS: { label: "In Progress", bg: "#dbeafe", fg: "#1e40af" },
  COMPLETED: { label: "Completed", bg: "#dcfce7", fg: "#166534" },
  CANCELLED: { label: "Cancelled", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const TRIP_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const WO_STATUS = {
  OPEN: { label: "Open", bg: "#fef3c7", fg: "#92400e" },
  SCHEDULED: { label: "Scheduled", bg: "#dbeafe", fg: "#1e40af" },
  IN_PROGRESS: { label: "In Progress", bg: "#e0e7ff", fg: "#3730a3" },
  COMPLETED: { label: "Completed", bg: "#dcfce7", fg: "#166534" },
  CANCELLED: { label: "Cancelled", bg: "#f1f5f9", fg: "#475569" },
} as const;
export const WO_STATUSES = ["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const WO_TYPES = ["SCHEDULED_SERVICE", "REPAIR", "INSPECTION", "TIRE", "OIL_CHANGE", "RECALL"] as const;

export const STATIONS = ["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"] as const;
export const STATION_LABEL: Record<string, string> = {
  AUS: "AUS — Austin",
  ACT: "ACT — Waco",
  IAH: "IAH — Houston",
  CLL: "CLL — College Station",
  BPT: "BPT — Beaumont",
  HRL: "HRL — Harlingen",
  LRD: "LRD — Laredo",
};

export const SERVICE_CATEGORY = {
  PREVENTIVE: { label: "Preventive", bg: "#dcfce7", fg: "#166534" },
  CORRECTIVE: { label: "Corrective", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const SERVICE_CATEGORIES = ["PREVENTIVE", "CORRECTIVE"] as const;

// Station order as it appears in the maintenance service-order form.
export const FORM_STATIONS = ["IAH", "AUS", "HRL", "LRD", "CLL", "BPT", "ACT"] as const;

// Preset service providers from the maintenance service-order form ("Other" allows free text).
export const SERVICE_PROVIDERS = [
  "Take5",
  "Discount Tire",
  "Ernesto",
  "Autoservicio De Leon",
  "Jiffy Lube",
] as const;

// Maps the preventive service catalog into the report's headline buckets,
// in display order. Catalog services not listed fall back to their own name.
export const PREVENTIVE_GROUPS: { label: string; services: string[] }[] = [
  { label: "Brakes", services: ["Brake Pad Replacement", "Brake Rotor Replacement", "Air Brake Cleaning"] },
  { label: "Tire Replacement", services: ["Tire Replacement", "Tire Rotation", "Tire Pressure Check / Fill"] },
  {
    label: "Oil Change",
    services: [
      "PM A – Basic Oil Change & Inspection",
      "PM B – Oil Change + Filters + Tire Rotation",
      "PM C – Full Preventive Maintenance",
    ],
  },
  { label: "Brake Calipers", services: ["Brake Caliper Replacement"] },
  { label: "Drivetrain Overhaul", services: ["Drivetrain Overhaul PM"] },
  { label: "Transmission Fluid", services: ["Transmission Fluid PM"] },
  { label: "Coolant + Spark Plugs", services: ["Coolant + Spark Plugs PM"] },
  { label: "Timing Belt", services: ["Timing Belt PM"] },
  { label: "Diesel Filter Cleaning", services: ["Diesel Filter Cleaning PM"] },
  { label: "Engine Air Filter", services: ["Engine Air Filter PM"] },
  { label: "Battery Replacement", services: ["Battery Replacement", "Battery Test"] },
  { label: "Fluids", services: ["Fluid Check / Fill up"] },
  { label: "Wiper Blades", services: ["Wiper Blades"] },
  { label: "Turbocharger Inspection", services: ["Turbocharger Inspection PM"] },
];

export const PRIORITY = {
  LOW: { label: "Low", bg: "#f1f5f9", fg: "#475569" },
  MEDIUM: { label: "Medium", bg: "#dbeafe", fg: "#1e40af" },
  HIGH: { label: "High", bg: "#fef3c7", fg: "#92400e" },
  CRITICAL: { label: "Critical", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const ALERT_SEVERITY = {
  INFO: { label: "Info", bg: "#dbeafe", fg: "#1e40af", color: "#2563eb" },
  WARNING: { label: "Warning", bg: "#fef3c7", fg: "#92400e", color: "#d97706" },
  CRITICAL: { label: "Critical", bg: "#fee2e2", fg: "#991b1b", color: "#dc2626" },
} as const;

export const ALERT_TYPE_LABEL: Record<string, string> = {
  SPEEDING: "Speeding",
  GEOFENCE_ENTER: "Geofence Enter",
  GEOFENCE_EXIT: "Geofence Exit",
  MAINTENANCE_DUE: "Maintenance Due",
  DOCUMENT_EXPIRY: "Document Expiry",
  LOW_FUEL: "Low Fuel",
  IDLE: "Idle",
  HARSH_DRIVING: "Harsh Driving",
};

export const GEOFENCE_TYPE = {
  DEPOT: { label: "Depot", color: "#2563eb" },
  CUSTOMER: { label: "Customer", color: "#16a34a" },
  SERVICE: { label: "Service", color: "#0891b2" },
  RESTRICTED: { label: "Restricted", color: "#dc2626" },
} as const;
export const GEOFENCE_TYPES = ["DEPOT", "CUSTOMER", "SERVICE", "RESTRICTED"] as const;

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
