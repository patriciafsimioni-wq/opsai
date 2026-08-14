// Brand identity is driven by env so the same codebase can serve multiple
// deployments (e.g. SYNCTX and TROVA), each pointed at its own database.
export const BRAND = process.env.NEXT_PUBLIC_BRAND?.trim() || "SYNCTX";

// The sister brand (the other deployment) used by the top-left brand switcher.
export const SISTER_BRAND = process.env.NEXT_PUBLIC_SISTER_BRAND?.trim() || "";
export const SISTER_BRAND_URL = process.env.NEXT_PUBLIC_SISTER_BRAND_URL?.trim() || "";
