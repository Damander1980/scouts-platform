import { compassRose } from "@/components/compass";
import { ImageResponse } from "next/og";

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  // 1024 is the app-store icon; 2732 the native apps' splash screen (a small mark on a large square).
  const px = ({ "180": 180, "512": 512, "1024": 1024, "2732": 2732 } as Record<string, number>)[size] ?? 192;
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inner = Math.round(px * (px === 2732 ? 0.24 : maskable ? 0.74 : 0.9));
  return new ImageResponse(
    (
      // The site's compass patch on gold (our own mark; deliberately not a fleur-de-lis, which is Scouting America's).
      <div style={{ width: px, height: px, background: "#F5B700", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={inner} height={inner} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="19.5" fill="#0C2442" />
          <circle cx="20" cy="20" r="17" fill="#F5B700" />
          <circle cx="20" cy="20" r="14.6" fill="none" stroke="#0C2442" strokeWidth="1" strokeDasharray="2 1.6" opacity=".55" />
          {compassRose(0.86).map((s, i) => <path key={i} d={s.d} fill={s.fill} />)}
          <circle cx="20" cy="20" r="1.6" fill="#F5B700" stroke="#0C2442" strokeWidth="0.8" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
