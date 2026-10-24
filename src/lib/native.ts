"use client";

// Helpers for the iOS and Android apps (a Capacitor shell around this site). On the web they fall back to
// normal browser behavior, so callers don't need to care where they run.
export const APP_SCHEME = "com.ourtroopmanager.app";

type Cap = { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean };
const cap = () => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: Cap }).Capacitor);

export function isNativeApp() {
  return !!cap()?.isNativePlatform?.();
}

/** True when this app build has the secure in-app sheet (and the com.ourtroopmanager.app:// return address).
 *  App builds installed before it was added keep working the old way: a normal page change. */
export function hasInAppSheet() {
  return isNativeApp() && !!cap()?.isPluginAvailable?.("Browser");
}

/** Payment pages, bank setup and other sites: an in-app browser sheet in the apps, a normal page change on the web.
 *  onClose runs when the person closes the sheet (for example after paying), so the page can show the new state. */
export async function openOutside(url: string, onClose?: () => void) {
  if (hasInAppSheet()) {
    let sub: { remove: () => void } | undefined;
    try {
      const { Browser } = await import("@capacitor/browser");
      if (onClose) sub = await Browser.addListener("browserFinished", () => { sub?.remove(); onClose(); });
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    } catch {
      // Fall through to a normal page change rather than leaving the button stuck.
      sub?.remove();
    }
  }
  window.location.href = url;
}
