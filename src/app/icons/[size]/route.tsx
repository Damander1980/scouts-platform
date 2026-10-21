import { ImageResponse } from "next/og";

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inner = Math.round(px * (maskable ? 0.52 : 0.64));
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, background: "#12355F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="#F5B700">
          <path d="M12 2c1.2 2.2 1.8 4 1.8 5.6 0 1.1-.5 2-1.8 3-1.3-1-1.8-1.9-1.8-3C10.2 6 10.8 4.2 12 2zM6.5 9c1.9.9 3.2 2 3.8 3.4.4 1 .2 1.9-.6 2.9-1.4-.1-2.4-.6-3-1.6C6 12.6 5.8 11.1 6.5 9zM17.5 9c.7 2.1.5 3.6-.2 4.7-.6 1-1.6 1.5-3 1.6-.8-1-1-1.9-.6-2.9.6-1.4 1.9-2.5 3.8-3.4zM10.5 15.5h3V19h-3z" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
