import { compassRose } from "@/components/compass";
import { ImageResponse } from "next/og";

// Link preview image (texts, email, social posts). Troop sites override it with their own icon.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Our Troop Manager: less paperwork, more Scouting";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#12355F", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#FFFFFF", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#F5B700", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="56" height="56" viewBox="0 0 40 40">
              {compassRose().map((s, i) => <path key={i} d={s.d} fill={s.fill} />)}
              <circle cx="20" cy="20" r="1.8" fill="#F5B700" stroke="#0C2442" strokeWidth="0.9" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>Our Troop Manager</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>Less paperwork.</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, color: "#F5B700" }}>More Scouting.</div>
        </div>
        <div style={{ fontSize: 30, color: "#D7E0EE" }}>Sign-ups, payments, health form status, advancement and messages for Scouts BSA troops.</div>
      </div>
    ),
    size,
  );
}
