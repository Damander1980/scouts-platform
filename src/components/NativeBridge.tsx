"use client";

import { useEffect } from "react";
import { APP_SCHEME, isNativeApp } from "@/lib/native";

// Runs only inside the iOS and Android apps:
// - Google sign-in happens in Apple's/Google's secure sheet (Google refuses sign-in inside an app's web view)
//   and returns here through com.ourtroopmanager.app://auth/callback?code=...; the code is finished on our
//   normal callback page, which holds the sign-in secret in this web view's cookies.
// - Android's back button goes back a screen instead of closing the app.
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.app = "1";
    const subs: { remove: () => void }[] = [];
    (async () => {
      const [{ App }, { Browser }] = await Promise.all([import("@capacitor/app"), import("@capacitor/browser")]);
      subs.push(await App.addListener("appUrlOpen", ({ url }) => {
        if (!url.startsWith(`${APP_SCHEME}://`)) return;
        Browser.close().catch(() => {});
        const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
        window.location.href = `${window.location.origin}/auth/callback${query}`;
      }));
      subs.push(await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back(); else App.minimizeApp();
      }));
    })();
    return () => subs.forEach((s) => s.remove());
  }, []);
  return null;
}
