import NativeBridge from "@/components/NativeBridge";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  twitter: { card: "summary_large_image" },
  title: { default: "Our Troop Manager", template: "%s · Our Troop Manager" },
  description: "RSVP, pay, attendance and advancement for your Scouting unit",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Our Troop Manager" },
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
      <head>
        {/* Inside the iOS/Android apps (their user agent carries OurTroopManagerApp): mark the page before it
            paints, so website-only parts (marketing, "Sign in / Start free") never flash. */}
        <script dangerouslySetInnerHTML={{ __html: "if(/OurTroopManagerApp/.test(navigator.userAgent))document.documentElement.dataset.app='1'" }} />
      </head>
      <body className="antialiased">
        {children}
        <RegisterSW />
        <NativeBridge />
      </body>
    </html>
  );
}
