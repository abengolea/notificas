import { ImageResponse } from "next/og";

import {
  INTERNATIONAL_DESCRIPTION,
  INTERNATIONAL_ORIGIN,
} from "@/lib/international-site";

export const runtime = "edge";
export const alt = "Notificas — Comunicaciones digitales verificables";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  const domain = INTERNATIONAL_ORIGIN.replace(/^https:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0ea5e9 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Notificas
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: 920,
            }}
          >
            Comunicaciones digitales verificables
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#e2e8f0",
              maxWidth: 880,
              lineHeight: 1.35,
            }}
          >
            {INTERNATIONAL_DESCRIPTION}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#cbd5e1",
          }}
        >
          <span>{domain}</span>
          <span>Argentina · Brasil · Colombia</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
