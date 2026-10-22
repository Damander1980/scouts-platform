import { ImageResponse } from "next/og";

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inner = Math.round(px * (maskable ? 0.52 : 0.64));
  return new ImageResponse(
    (
      // Mountain mark on gold (our own mark; deliberately not a fleur-de-lis, which is Scouting America's).
      <div style={{ width: px, height: px, background: "#F5B700", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24">
          <path d="M2 19.5 8.6 8.2l3.6 6 2.4-3.6 7.4 8.9z" fill="#12355F" />
          <path d="M8.6 8.2 10.7 11.7 9.4 11 8.1 12.1 7 11z" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
