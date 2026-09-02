import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Generated (not static) so each deployment installs under its own brand:
// SYNCTX and TROVA share this codebase but must not share an app name or icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} Fleet`,
    short_name: BRAND,
    description:
      "Fleet management: GPS tracking, maintenance, work orders, fuel, DVIR and analytics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1e3a8a",
    theme_color: "#1e40af",
    orientation: "any",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
