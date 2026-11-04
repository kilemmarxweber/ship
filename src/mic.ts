import { requireOptionalNativeModule } from "expo-modules-core";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

export type MicAccess = "granted" | "denied" | "blocked";

function openMicSettings() {
  void Linking.openSettings();
}

function explainBlockedMic() {
  Alert.alert(
    "Micro bloqué",
    Platform.OS === "ios"
      ? "Réglages > ShipShop > Microphone → Autoriser"
      : "Paramètres > Applications > ShipShop > Autorisations > Microphone → Autoriser",
    [
      { text: "Plus tard", style: "cancel" },
      { text: "Ouvrir les réglages", onPress: openMicSettings },
    ],
  );
}

async function expoAudio() {
  try {
    if (!requireOptionalNativeModule("ExpoAudio")) return null;
    return await import("expo-audio");
  } catch {
    return null;
  }
}

async function androidFallback(): Promise<MicAccess> {
  if (Platform.OS !== "android") return "denied";
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  try {
    if (await PermissionsAndroid.check(permission)) return "granted";
    const result = await PermissionsAndroid.request(permission, {
      title: "Micro du live",
      message: "Autorise le micro pour que tes spectateurs t’entendent.",
      buttonPositive: "Autoriser",
      buttonNegative: "Plus tard",
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) return "granted";
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "blocked";
    return "denied";
  } catch {
    return "blocked";
  }
}

export async function demanderMicro(options?: {
  openSettingsIfBlocked?: boolean;
}): Promise<boolean> {
  const access = await microphoneStatus(options);
  return access === "granted";
}

export async function microphoneStatus(options?: {
  openSettingsIfBlocked?: boolean;
}): Promise<MicAccess> {
  const goToSettings = options?.openSettingsIfBlocked !== false;
  const Audio = await expoAudio();

  try {
    if (Audio) {
      const current = await Audio.getRecordingPermissionsAsync();
      if (current.granted) return "granted";
      if (current.canAskAgain) {
        const next = await Audio.requestRecordingPermissionsAsync();
        if (next.granted) return "granted";
        if (next.canAskAgain === false) {
          if (goToSettings) explainBlockedMic();
          return "blocked";
        }
        return "denied";
      }
      if (goToSettings) explainBlockedMic();
      return "blocked";
    }

    const fallback = await androidFallback();
    if (fallback === "blocked" && goToSettings) explainBlockedMic();
    return fallback;
  } catch {
    const fallback = await androidFallback();
    if (fallback === "blocked" && goToSettings) explainBlockedMic();
    return fallback;
  }
}
