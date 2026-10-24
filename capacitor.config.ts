import type { CapacitorConfig } from "@capacitor/cli";

// The iOS and Android apps are a native shell around the live site, so every web release reaches the apps
// with no store resubmission. The site recognizes the apps by "OurTroopManagerApp" in the user agent and
// drops website-only parts (marketing page, sign-in side panel). Payments and Google sign-in open in the
// system's secure in-app sheet and come back through com.ourtroopmanager.app://. mobile/www is only the
// screen shown if the phone is offline when the app starts.
const config: CapacitorConfig = {
  appId: "com.ourtroopmanager.app",
  appName: "Our Troop Manager",
  webDir: "mobile/www",
  appendUserAgent: "OurTroopManagerApp",
  backgroundColor: "#E9E3D6",
  server: {
    url: "https://ourtroopmanager.com/home",
    cleartext: false,
    errorPath: "offline.html",
    allowNavigation: ["ourtroopmanager.com", "www.ourtroopmanager.com"],
  },
  ios: { contentInset: "automatic" },
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
