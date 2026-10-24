"use client";

// Helpers for the iOS and Android apps (a Capacitor shell around this site). On the web they fall back to
// normal browser behavior, so callers don't need to care where they run.
export const APP_SCHEME = "com.ourtroopmanager.app";

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Payment pages, bank setup and other sites: an in-app browser sheet in the apps, a normal page change on the web. */
export async function openOutside(url: string) {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
    return;
  }
  window.location.href = url;
}
