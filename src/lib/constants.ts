import { BRAND } from "@/lib/brand";

export const VEHICLE_STATUS = {
  ACTIVE: { label: "Active", color: "#16a34a", bg: "#dcfce7", fg: "#166534" },
  IDLE: { label: "Idle", color: "#d97706", bg: "#fef3c7", fg: "#92400e" },
  MAINTENANCE: { label: "Maintenance", color: "#2563eb", bg: "#dbeafe", fg: "#1e40af" },
  OUT_OF_SERVICE: { label: "Out of Service", color: "#dc2626", bg: "#fee2e2", fg: "#991b1b" },
} as const;

export const VEHICLE_TYPES = ["TRUCK", "VAN", "CAR", "BUS", "PICKUP", "TRAILER"] as const;
export const VEHICLE_STATUSES = ["ACTIVE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE"] as const;
export const FUEL_TYPES = ["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"] as const;

export const LIFECYCLE_STATUS = {
  PLANNING: { label: "Planning", bg: "#f1f5f9", fg: "#475569", color: "#64748b" },
  ACQUISITION_APPROVED: { label: "Acquisition Approved", bg: "#dbeafe", fg: "#1e40af", color: "#2563eb" },
  ORDERED: { label: "Ordered", bg: "#e0e7ff", fg: "#3730a3", color: "#4f46e5" },
  IN_TRANSIT: { label: "In Transit", bg: "#fef3c7", fg: "#92400e", color: "#d97706" },
  RECEIVED: { label: "Received", bg: "#cffafe", fg: "#155e75", color: "#0891b2" },
  UPFITTING: { label: "Upfitting / Branding", bg: "#fce7f3", fg: "#9d174d", color: "#db2777" },
  REGISTERED: { label: "Registered & Insured", bg: "#d1fae5", fg: "#065f46", color: "#059669" },
  ASSIGNED: { label: "Assigned to Station", bg: "#ede9fe", fg: "#5b21b6", color: "#7c3aed" },
  ACTIVE: { label: "Active", bg: "#dcfce7", fg: "#166534", color: "#16a34a" },
  TEMP_OUT: { label: "Temporary Out of Service", bg: "#fef3c7", fg: "#78350f", color: "#b45309" },
  LONG_TERM_REPAIR: { label: "Long-Term Repair", bg: "#fee2e2", fg: "#991b1b", color: "#dc2626" },
  READY_DISPOSAL: { label: "Ready for Disposal", bg: "#fecaca", fg: "#7f1d1d", color: "#b91c1c" },
  SOLD_RETURNED: { label: "Sold / Returned / End of Lease", bg: "#e2e8f0", fg: "#334155", color: "#475569" },
  ARCHIVED: { label: "Archived", bg: "#f1f5f9", fg: "#64748b", color: "#94a3b8" },
} as const;

export const LIFECYCLE_STATUSES = Object.keys(LIFECYCLE_STATUS) as (keyof typeof LIFECYCLE_STATUS)[];

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

// Station config is brand-aware so the same codebase serves SYNCTX (Texas/DHL
// stations) and TROVA (Virginia — ORF / RNH), each pointed at its own database.
const IS_TROVA = BRAND.toUpperCase() === "TROVA";

export const STATIONS: readonly string[] = IS_TROVA
  ? ["ORF", "RNH"]
  : ["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"];

export const STATION_LABEL: Record<string, string> = {
  AUS: "AUS — Austin",
  ACT: "ACT — Waco",
  IAH: "IAH — Houston",
  CLL: "CLL — College Station",
  BPT: "BPT — Beaumont",
  HRL: "HRL — Harlingen",
  LRD: "LRD — Laredo",
  ORF: "ORF — Norfolk",
  RNH: "RNH — Richmond",
};

// Contracted fleet plan — target vehicles per station.
export const STATION_TARGETS: Record<string, number> = IS_TROVA
  ? { RNH: 22, ORF: 14 }
  : {
      IAH: 48,
      AUS: 34,
      HRL: 12,
      ACT: 5,
      LRD: 4,
      CLL: 4,
      BPT: 3,
    };

export const SERVICE_CATEGORY = {
  PREVENTIVE: { label: "Preventive", bg: "#dcfce7", fg: "#166534" },
  CORRECTIVE: { label: "Corrective", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const SERVICE_CATEGORIES = ["PREVENTIVE", "CORRECTIVE"] as const;

// Station order as it appears in the maintenance service-order form.
export const FORM_STATIONS: readonly string[] = IS_TROVA
  ? ["ORF", "RNH"]
  : ["IAH", "AUS", "HRL", "LRD", "CLL", "BPT", "ACT"];

// Preset service providers from the maintenance service-order form ("Other" allows free text).
export const SERVICE_PROVIDERS = [
  "Take5",
  "Discount Tire",
  "Ernesto",
  "Autoservicio De Leon",
  "Jiffy Lube",
  "Autopaint Solutions",
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

/** 14 PM budget categories that map to the finance report's service lines. */
export const PM_CATEGORIES = [
  "Brakes",
  "Tires Replacement",
  "Oil Change",
  "Brake Calipers",
  "Drivetrain Overhaul",
  "Transmission Fluid",
  "Coolant + Spark plugs",
  "Time Belt",
  "Diesel Filter Cleaning",
  "Engine Filter",
  "Battery Replacement",
  "Fluids",
  "Wiper Replacement",
  "Turbo Charger Inspection",
] as const;

/** Maps work-order titles (from service history) → PM budget category. */
export const WO_TITLE_TO_PM_CATEGORY: Record<string, string> = {
  "PM A – Basic Oil Change & Inspection": "Oil Change",
  "PM B – Oil Change + Filters + Tire Rotation": "Oil Change",
  "PM C – Full Preventive Maintenance": "Oil Change",
  "Brake Pad Replacement": "Brakes",
  "Brake Rotor Replacement": "Brakes",
  "Air Brake Cleaning": "Brakes",
  "Brake Caliper Replacement": "Brake Calipers",
  "Tire Replacement": "Tires Replacement",
  "Tire Rotation": "Tires Replacement",
  "Tire Pressure Check / Fill": "Tires Replacement",
  "Drivetrain Overhaul PM": "Drivetrain Overhaul",
  "Transmission Fluid PM": "Transmission Fluid",
  "Coolant + Spark Plugs PM": "Coolant + Spark plugs",
  "Timing Belt PM": "Time Belt",
  "Diesel Filter Cleaning PM": "Diesel Filter Cleaning",
  "Engine Air Filter PM": "Engine Filter",
  "Battery Replacement": "Battery Replacement",
  "Battery Test": "Battery Replacement",
  "Fluid Check / Fill up": "Fluids",
  "Wiper Blades": "Wiper Replacement",
  "Turbocharger Inspection PM": "Turbo Charger Inspection",
  "DOT Annual Inspection": "Brakes",
};

/** Corrective Repair budget categories for the finance report (matches CR PDF template). */
export const CR_CATEGORIES = [
  "Mechanical Repairs",
  "Engine Services",
  "Electrical Repairs",
  "A/C & Heating",
  "Cosmetic / Utility",
] as const;

/** Maps work-order titles (from service history) → CR budget category. */
export const WO_TITLE_TO_CR_CATEGORY: Record<string, string> = {
  "Engine Work": "Engine Services",
  "DEF System": "Engine Services",
  "Turbo / Actuator": "Engine Services",
  "Bodyshop Repair": "Cosmetic / Utility",
  "Vehicle Wash": "Cosmetic / Utility",
  "Interior Detail": "Cosmetic / Utility",
  "Decal / Sticker Application": "Cosmetic / Utility",
  "Samsara Device Install / Uninstall": "Cosmetic / Utility",
  "Key Replacement or Programming": "Cosmetic / Utility",
  "Body service - Fix Damage, Dent and Paint": "Cosmetic / Utility",
  "Doors - Panel and Latch": "Cosmetic / Utility",
  "Rollers - Fix Roller Bed": "Cosmetic / Utility",
  "Windshield Replacement": "Cosmetic / Utility",
  "Replace Part - Bumper, headlight, Trims, etc": "Cosmetic / Utility",
  "AC Work": "A/C & Heating",
  "Radiator Work": "Mechanical Repairs",
  "Transmission Work": "Mechanical Repairs",
  "Hose Replacement": "Mechanical Repairs",
  "Electrical Repairs": "Electrical Repairs",
  "Parts Purchase / Order": "Mechanical Repairs",
  "Parts Purchase / Autozone / Oreillys": "Mechanical Repairs",
  "REGISTRATION": "Cosmetic / Utility",
  "Other": "Mechanical Repairs",
  "Purge brakes": "Mechanical Repairs",
  "Fluids Check": "Mechanical Repairs",
};

/** Stations shown in the finance report. */
export const FINANCE_STATIONS: readonly string[] = IS_TROVA
  ? ["ORF", "RNH"]
  : ["IAH", "AUS", "HRL", "LRD"];

/** Station → 2-letter PO prefix and starting sequence number. */
export const PO_PREFIX: Record<string, string> = {
  IAH: "IA",
  AUS: "AU",
  HRL: "HR",
  ACT: "AC",
  LRD: "LR",
  CLL: "CL",
  BPT: "BP",
  ORF: "OR",
  RNH: "RN",
};

/** First PO number to use per station (inclusive). Earlier numbers are assumed taken. */
export const PO_START: Record<string, number> = {
  IAH: 269,
  AUS: 290,
  HRL: 178,
  ACT: 38,
  LRD: 15,
  CLL: 35,
  BPT: 11,
  ORF: 1,
  RNH: 1,
};

export const WO_REQUEST_STATUS = {
  PENDING: { label: "Pending", bg: "#fef3c7", fg: "#92400e" },
  APPROVED: { label: "Approved", bg: "#dcfce7", fg: "#166534" },
  REJECTED: { label: "Rejected", bg: "#fee2e2", fg: "#991b1b" },
} as const;
export const WO_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const PARTS_LIST = [
  "Brake pads", "Brake rotors", "Brake calipers", "Oil filter", "Air filter",
  "Cabin air filter", "Spark plugs", "Wiper blades", "Battery", "Coolant",
  "Transmission fluid", "Serpentine belt", "Timing belt", "Alternator",
  "Starter motor", "Radiator", "Water pump", "Fuel pump", "Fuel filter",
  "Muffler", "Catalytic converter", "Turbocharger", "A/C compressor",
  "Headlight bulb", "Taillight bulb", "Windshield", "Tire", "Wheel bearing",
  "Shock absorber", "Strut", "CV joint", "U-joint", "Driveshaft",
  "Thermostat", "Oxygen sensor", "Mass airflow sensor", "Ignition coil",
  "EGR valve", "PCV valve", "Power steering fluid",
] as const;

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

/**
 * Vehicle lifecycle PM schedule — mileage-based services.
 * Each entry: [mileage, service name].
 */
export const MILEAGE_SCHEDULE: [number, string][] = [
  [6000, "Oil + Filter + Tire Rotation"],
  [10000, "Fluids"],
  [12000, "Oil + Filter + Tire Rotation"],
  [18000, "Oil + Filter + Tire Rotation"],
  [20000, "Brake Pads Replacement"],
  [20000, "Fluids"],
  [24000, "Oil + Filter + Tire Rotation"],
  [24000, "Brake Inspection + Cabin Air"],
  [30000, "Oil + Filter + Tire Rotation"],
  [30000, "Engine Air Filter"],
  [30000, "Fluids"],
  [30000, "Air Brake Cleaning"],
  [36000, "Oil + Filter + Tire Rotation"],
  [36000, "Brake Inspection + Cabin Air"],
  [40000, "Oil + Filter + Tire Rotation"],
  [40000, "Brake Pads Replacement"],
  [40000, "Brake Calipers"],
  [40000, "Fluids"],
  [40000, "Tire Replacement"],
  [42000, "Oil + Filter + Tire Rotation"],
  [48000, "Oil + Filter + Tire Rotation"],
  [48000, "Brake Inspection + Cabin Air"],
  [50000, "Transmission Fluid"],
  [50000, "Turbocharger Inspection"],
  [50000, "Fluids"],
  [50000, "Tire Replacement"],
  [54000, "Oil + Filter + Tire Rotation"],
  [60000, "Oil + Filter + Tire Rotation"],
  [60000, "Engine Air Filter"],
  [60000, "Brake Pads Replacement"],
  [60000, "Fluids"],
  [60000, "Air Brake Cleaning"],
  [66000, "Oil + Filter + Tire Rotation"],
  [70000, "Fluids"],
  [72000, "Oil + Filter + Tire Rotation"],
  [72000, "Brake Pads Replacement"],
  [78000, "Oil + Filter + Tire Rotation"],
  [80000, "Fluids"],
  [80000, "Tire Replacement"],
  [80000, "Battery Replacement"],
  [84000, "Oil + Filter + Tire Rotation"],
  [84000, "Brake Pads Replacement"],
  [90000, "Fluids"],
  [90000, "Oil + Filter + Tire Rotation"],
  [90000, "Engine Air Filter"],
  [90000, "Air Brake Cleaning"],
  [96000, "Oil + Filter + Tire Rotation"],
  [96000, "Brake Pads Replacement"],
  [100000, "Fluids"],
  [100000, "Transmission Fluid"],
  [100000, "Coolant + Spark Plugs"],
  [100000, "Turbocharger Inspection"],
  [102000, "Oil + Filter + Tire Rotation"],
  [108000, "Oil + Filter + Tire Rotation"],
  [108000, "Brake Pads Replacement"],
  [110000, "Fluids"],
  [110000, "Air Brake Cleaning"],
  [114000, "Oil + Filter + Tire Rotation"],
  [120000, "Fluids"],
  [120000, "Oil + Filter + Tire Rotation"],
  [120000, "Engine Air Filter"],
  [120000, "Brake Pads Replacement"],
  [120000, "Tire Replacement"],
  [126000, "Oil + Filter + Tire Rotation"],
  [130000, "Fluids"],
  [132000, "Oil + Filter + Tire Rotation"],
  [132000, "Brake Pads Replacement"],
  [138000, "Oil + Filter + Tire Rotation"],
  [140000, "Fluids"],
  [144000, "Oil + Filter + Tire Rotation"],
  [144000, "Brake Pads Replacement"],
  [150000, "Fluids"],
  [150000, "Oil + Filter + Tire Rotation"],
  [150000, "Engine Air Filter"],
  [150000, "Transmission Fluid"],
  [150000, "Timing Belt"],
  [150000, "Turbocharger Inspection"],
  [150000, "Diesel Filter Cleaning"],
  [150000, "Air Brake Cleaning"],
  [156000, "Oil + Filter + Tire Rotation"],
  [156000, "Brake Pads Replacement"],
  [160000, "Fluids"],
  [160000, "Tire Replacement"],
  [160000, "Battery Replacement"],
  [162000, "Oil + Filter + Tire Rotation"],
  [168000, "Oil + Filter + Tire Rotation"],
  [168000, "Brake Pads Replacement"],
  [170000, "Fluids"],
  [174000, "Oil + Filter + Tire Rotation"],
  [180000, "Fluids"],
  [180000, "Oil + Filter + Tire Rotation"],
  [180000, "Engine Air Filter"],
  [180000, "Brake Pads Replacement"],
  [180000, "Air Brake Cleaning"],
  [186000, "Oil + Filter + Tire Rotation"],
  [190000, "Fluids"],
  [192000, "Oil + Filter + Tire Rotation"],
  [192000, "Brake Pads Replacement"],
  [198000, "Oil + Filter + Tire Rotation"],
  [200000, "Fluids"],
  [200000, "Transmission Fluid"],
  [200000, "Coolant + Spark Plugs"],
  [200000, "Turbocharger Inspection"],
  [200000, "Tire Replacement"],
  [204000, "Oil + Filter + Tire Rotation"],
  [204000, "Brake Pads Replacement"],
  [210000, "Fluids"],
  [210000, "Oil + Filter + Tire Rotation"],
  [210000, "Engine Air Filter"],
  [210000, "Air Brake Cleaning"],
  [216000, "Oil + Filter + Tire Rotation"],
  [216000, "Brake Pads Replacement"],
  [220000, "Fluids"],
  [222000, "Oil + Filter + Tire Rotation"],
  [228000, "Oil + Filter + Tire Rotation"],
  [228000, "Brake Pads Replacement"],
  [230000, "Fluids"],
  [234000, "Oil + Filter + Tire Rotation"],
  [240000, "Fluids"],
  [240000, "Air Brake Cleaning"],
  [240000, "Oil + Filter + Tire Rotation"],
  [240000, "Engine Air Filter"],
  [240000, "Battery Replacement"],
  [240000, "Brake Pads Replacement"],
  [246000, "Oil + Filter + Tire Rotation"],
  [250000, "Fluids"],
  [250000, "Transmission Fluid"],
  [250000, "Drivetrain Overhaul"],
  [250000, "Turbocharger Inspection"],
  [252000, "Oil + Filter + Tire Rotation"],
  [252000, "Brake Pads Replacement"],
];

/** Time-based services (months interval). */
export const TIME_SCHEDULE: [number, string][] = [
  [12, "Wiper Blades"],
];

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
