import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export type HapticEvent = "selection" | "play" | "trump" | "trick" | "score" | "complete";

export async function initializeNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setBackgroundColor({ color: "#071411" }),
    SplashScreen.hide()
  ]);
}

export async function emitHaptic(event: HapticEvent, enabled: boolean): Promise<void> {
  if (!enabled || !Capacitor.isNativePlatform()) return;
  if (event === "complete" || event === "score") {
    await Haptics.notification({ type: event === "complete" ? NotificationType.Success : NotificationType.Warning });
    return;
  }
  await Haptics.impact({
    style: event === "selection" ? ImpactStyle.Light : event === "trick" ? ImpactStyle.Medium : ImpactStyle.Heavy
  });
}

export async function shareText(title: string, text: string): Promise<"shared" | "unavailable"> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text, dialogTitle: title });
    return "shared";
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return "shared";
  }
  return "unavailable";
}

export async function listenForAppState(
  callback: (active: boolean) => void
): Promise<() => Promise<void>> {
  const handles: PluginListenerHandle[] = [];
  const visibilityHandler = () => callback(!document.hidden);
  document.addEventListener("visibilitychange", visibilityHandler);
  if (Capacitor.isNativePlatform()) {
    handles.push(await CapacitorApp.addListener("appStateChange", ({ isActive }) => callback(isActive)));
  }
  return async () => {
    document.removeEventListener("visibilitychange", visibilityHandler);
    await Promise.all(handles.map((handle) => handle.remove()));
  };
}
