import { ImageResponse } from "next/og";

// Link preview image (texts, email, social posts) for the landing page.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ScoutPlatform: less paperwork, more Scouting";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#12355F", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#FFFFFF", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#F5B700", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24">
              <path d="M2 19.5 8.6 8.2l3.6 6 2.4-3.6 7.4 8.9z" fill="#12355F" />
              <path d="M8.6 8.2 10.7 11.7 9.4 11 8.1 12.1 7 11z" fill="#FFFFFF" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>ScoutPlatform</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>Less paperwork.</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, color: "#F5B700" }}>More Scouting.</div>
        </div>
        <div style={{ fontSize: 30, color: "#D7E0EE" }}>Sign-ups, payments, health forms, advancement and messages for Scouts BSA troops.</div>
      </div>
    ),
    size,
  );
}
