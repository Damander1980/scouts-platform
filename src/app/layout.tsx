import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  twitter: { card: "summary_large_image" },
  title: { default: "ScoutPlatform", template: "%s · ScoutPlatform" },
  description: "RSVP, pay, attendance and advancement for your Scouting unit",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ScoutPlatform" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#12355F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
