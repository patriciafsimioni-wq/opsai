import { WO_TITLE_TO_PM_CATEGORY, WO_TITLE_TO_CR_CATEGORY } from "@/lib/constants";

// Shared work-order classifiers used by BOTH the Finance Report table
// (finance-report/route.ts) and the slide deck (finance-report/slides/route.ts)
// so the two can never diverge. Previously each route had its own copy and the
// slides one was stale, undercounting PM spend (e.g. dropping "BRAKE SERVICE",
// "TUNE UP", brake-part SKUs) versus the table.

export function classifyPM(title: string): string | null {
  if (WO_TITLE_TO_PM_CATEGORY[title]) return WO_TITLE_TO_PM_CATEGORY[title];
  const lower = title.toLowerCase();
  if (lower.includes("brake pad") || lower.includes("brake rotor") || lower.includes("air brake") || lower.includes("rotor sku") || lower.includes("dlg rotor") || lower.includes("brake wear") || lower.includes("duralast gold br") || lower.includes("brake service") || lower.includes("slack adjust") || lower.includes("slack replace") || lower.includes("freno")) return "Brakes";
  if (lower.includes("tire") || lower.includes("tires") || lower.includes("llanta") || lower.includes("neumatic")) return "Tires Replacement";
  if (lower.includes("oil change") || lower.includes("pm a") || lower.includes("pm b") || lower.includes("pm c") || lower.includes("tune up") || lower.includes("tune-up")) return "Oil Change";
  if (lower.includes("caliper")) return "Brake Calipers";
  if (lower.includes("drivetrain")) return "Drivetrain Overhaul";
  if (lower.includes("transmission")) return "Transmission Fluid";
  if (lower.includes("coolant") || lower.includes("spark plug") || lower.includes("radiator")) return "Coolant + Spark plugs";
  if (lower.includes("timing") || lower.includes("time belt")) return "Time Belt";
  if (lower.includes("diesel filter")) return "Diesel Filter Cleaning";
  if (lower.includes("engine filter") || lower.includes("engine air filter") || lower.includes("air filter") || lower.includes("filtro de aire") || lower.includes("filtro aire")) return "Engine Filter";
  if (lower.includes("battery") || lower.includes("bateria") || lower.includes("batería") || lower.includes("parking brake actuator")) return "Battery Replacement";
  if (lower.includes("fluid") || lower.includes("fluido") || lower.includes("engrasado") || lower.includes("aceite")) return "Fluids";
  if (lower.includes("wiper")) return "Wiper Replacement";
  if (lower.includes("turbo")) return "Turbo Charger Inspection";
  if (lower.includes("dot") || lower.includes("inspection") || lower.includes("inspec")) return "Brakes";
  if (lower.includes("bulb") || lower.includes("light") || lower.includes("h11")) return "Wiper Replacement";
  return null;
}

export function classifyCR(title: string): string | null {
  if (WO_TITLE_TO_CR_CATEGORY[title]) return WO_TITLE_TO_CR_CATEGORY[title];
  const lower = title.toLowerCase();
  // Corrective categories are matched first so genuinely corrective work
  // (engine/electrical/AC/body) is captured even if it shares a keyword with
  // a preventive service.
  if (lower.includes("engine") || lower.includes("def system") || lower.includes("turbo") || lower.includes("actuator")) return "Engine Services";
  if (lower.includes("electric") || lower.includes("wiring") || lower.includes("fuse")) return "Electrical Repairs";
  if (lower.includes("ac ") || lower.includes("a/c") || lower.includes("heating") || lower.includes("hvac")) return "A/C & Heating";
  if (
    lower.includes("body") ||
    lower.includes("cosmetic") ||
    lower.includes("paint") ||
    lower.includes("dent") ||
    lower.includes("registration") ||
    lower.includes("wash") ||
    lower.includes("detail") ||
    lower.includes("decal") ||
    lower.includes("sticker") ||
    lower.includes("samsara") ||
    lower.includes("key replacement") ||
    lower.includes("key programming") ||
    lower.includes("door") ||
    lower.includes("latch") ||
    lower.includes("roller") ||
    lower.includes("windshield") ||
    lower.includes("bumper") ||
    lower.includes("headlight") ||
    lower.includes("trim")
  ) return "Cosmetic / Utility";
  // Explicitly corrective mechanical repairs (these share keywords with PM
  // services like "transmission fluid" / "radiator coolant", so keep them here).
  if (
    lower.includes("transmission") ||
    lower.includes("radiator") ||
    lower.includes("cooling system") ||
    lower.includes("suspension") ||
    lower.includes("exhaust") ||
    lower.includes("drivetrain overhaul") ||
    lower.includes("spark plug") ||
    lower.includes("repair") ||
    lower.includes("replace part")
  ) return "Mechanical Repairs";
  // Anything the preventive classifier recognizes is PM — never corrective.
  if (classifyPM(title) !== null) return null;
  return "Mechanical Repairs";
}
