import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// iOS home-screen icon (iPhone/iPad "Add to Home Screen"). Opaque and
// square-edged: iOS applies its own rounded mask and renders transparency black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const fontSize = Math.min(48, Math.round(214 / Math.max(BRAND.length, 4)));

export default function AppleIcon() {
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
          letterSpacing: -1,
          textAlign: "center",
          padding: 14,
        }}
      >
        {BRAND}
      </div>
    ),
    size,
  );
}
