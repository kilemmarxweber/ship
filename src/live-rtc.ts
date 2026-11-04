import {
    Linking,
    NativeModules,
    PermissionsAndroid,
    Platform,
} from "react-native";

import { demanderMicro, microphoneStatus, type MicAccess } from "@/src/mic";

export { demanderMicro, type MicAccess };

export type LiveAvPermission = {
  camera: boolean;
  microphone: boolean;
  notifications: boolean;
};

type AndroidPermission =
  (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

const ANDROID_CAMERA = PermissionsAndroid.PERMISSIONS.CAMERA;
const ANDROID_NOTIFY =
  (PermissionsAndroid.PERMISSIONS as { POST_NOTIFICATIONS?: AndroidPermission })
    .POST_NOTIFICATIONS ??
  ("android.permission.POST_NOTIFICATIONS" as AndroidPermission);

const RATIONALE = {
  camera: {
    title: "Caméra du live",
    message: "Autorise la caméra pour que tes spectateurs te voient.",
    buttonPositive: "Autoriser",
    buttonNegative: "Plus tard",
  },
  notifications: {
    title: "Notifications",
    message: "Autorise les notifications pour tes lives et commandes.",
    buttonPositive: "Autoriser",
    buttonNegative: "Plus tard",
  },
} as const;

export function isLiveRtcAvailable() {
  try {
    return NativeModules.WebRTCModule != null;
  } catch {
    return false;
  }
}

function granted(value: string | boolean | undefined) {
  return value === true || value === PermissionsAndroid.RESULTS.GRANTED;
}

function toAccess(result: string | boolean | undefined): MicAccess {
  if (granted(result)) return "granted";
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "blocked";
  return "denied";
}

async function requestAndroid(
  permission: AndroidPermission,
  rationale: (typeof RATIONALE)[keyof typeof RATIONALE],
): Promise<MicAccess> {
  try {
    if (await PermissionsAndroid.check(permission)) return "granted";
    const result = await PermissionsAndroid.request(permission, rationale);
    return toAccess(result);
  } catch {
    return "blocked";
  }
}

export async function ensureCameraPermission() {
  if (Platform.OS !== "android") {
    return (await requestLiveAvPermissions()).camera;
  }
  return (await requestAndroid(ANDROID_CAMERA, RATIONALE.camera)) === "granted";
}

export async function microphoneAccess(): Promise<MicAccess> {
  return microphoneStatus({ openSettingsIfBlocked: false });
}

export async function ensureMicrophonePermission() {
  return demanderMicro({ openSettingsIfBlocked: false });
}

export function openAppSettings() {
  void Linking.openSettings();
}

export async function requestNotificationPermission() {
  if (Platform.OS !== "android") return true;
  return (
    (await requestAndroid(ANDROID_NOTIFY, RATIONALE.notifications)) ===
    "granted"
  );
}

export async function requestLiveAvPermissions(): Promise<LiveAvPermission> {
  if (Platform.OS === "android") {
    const camera = await requestAndroid(ANDROID_CAMERA, RATIONALE.camera);
    const microphone = await microphoneAccess();
    const notifications = await requestAndroid(
      ANDROID_NOTIFY,
      RATIONALE.notifications,
    );
    return {
      camera: camera === "granted",
      microphone: microphone === "granted",
      notifications: notifications === "granted",
    };
  }
  try {
    const ImagePicker = await import("expo-image-picker");
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    const microphone = await microphoneAccess();
    return {
      camera: cam.granted,
      microphone: microphone === "granted",
      notifications: true,
    };
  } catch {
    return { camera: true, microphone: true, notifications: true };
  }
}
