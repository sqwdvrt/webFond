import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name}. ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          background: "#f7f6f1",
          color: "#202622",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              border: "2px solid #2E7D32",
              background: "#ffffff",
            }}
          />
          <div
            style={{
              fontSize: 22,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Благотворительный фонд
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05, fontWeight: 500 }}>
            Быть Добру
          </div>
          <div style={{ fontSize: 32, color: "#626b65" }}>{siteConfig.tagline}</div>
        </div>
        <div style={{ fontSize: 22, color: "#1f5b25" }}>
          {siteConfig.legal.emailLabel}
        </div>
      </div>
    ),
    { ...size },
  );
}
