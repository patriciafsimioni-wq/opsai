import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// Home-screen / install icon. Generated from the brand name so SYNCTX and TROVA
// each get their own icon from the shared codebase. Full-bleed background with
// the wordmark inside the middle 80% so it survives Android's maskable crop and
// iOS's squircle mask.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Scaled to the wordmark's length so it stays inside the maskable safe zone
// (the middle 80%) instead of being cropped on Android/iOS home screens.
const fontSize = Math.min(140, Math.round(544 / Math.max(BRAND.length, 4)));

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e40af",
          color: "#ffffff",
          fontSize,
          fontWeight: 700,
          letterSpacing: -2,
          textAlign: "center",
          padding: 56,
        }}
      >
        {BRAND}
      </div>
    ),
    size,
  );
}
