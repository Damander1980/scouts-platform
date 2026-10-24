import type { CapacitorConfig } from "@capacitor/cli";

// The iOS and Android apps are a native shell around the live site, so every web release reaches the apps
// with no store resubmission. Native parts: push notifications and app lifecycle. mobile/www is only the
// screen shown if the phone is offline when the app starts.
const config: CapacitorConfig = {
  appId: "com.ourtroopmanager.app",
  appName: "Our Troop Manager",
  webDir: "mobile/www",
  server: {
    url: "https://ourtroopmanager.com/home",
    cleartext: false,
    errorPath: "offline.html",
  },
  ios: { contentInset: "automatic" },
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
