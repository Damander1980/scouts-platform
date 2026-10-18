import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the user's home folder makes Next guess the wrong root.
  outputFileTracingRoot: path.join(__dirname),
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default nextConfig;
