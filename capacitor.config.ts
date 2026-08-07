import type { CapacitorConfig } from "@capacitor/cli";
import release from "./mobile.release.json";

const config: CapacitorConfig = {
  appId: release.bundleIdentifier,
  appName: release.appName,
  webDir: "dist-mobile",
  loggingBehavior: "none",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "EuchreClub"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: "#071411",
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#071411",
      overlaysWebView: true
    }
  }
};

export default config;
