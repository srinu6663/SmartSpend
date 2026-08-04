import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Android build.
 *
 * This app is sideloaded for personal use, not distributed through Play Store —
 * which is what makes READ_SMS viable at all. Google Play restricts READ_SMS to
 * apps whose core function is SMS handling (default SMS app, etc.), so a build
 * using it would be rejected there. See android/README-SMS.md.
 */
const config: CapacitorConfig = {
  appId: "app.finly.personal",
  appName: "Finly",
  webDir: "dist",

  android: {
    // Keep the WebView on https so Supabase auth, service workers and secure
    // cookies behave the same as on the web build.
    allowMixedContent: false,
  },

  server: {
    androidScheme: "https",
  },

  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#4F46E5",
    },
  },
};

export default config;
