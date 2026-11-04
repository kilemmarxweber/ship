export type LiveAvPermission = {
  camera: boolean;
  microphone: boolean;
  notifications: boolean;
};

export function isLiveRtcAvailable() {
  return false;
}

export async function ensureCameraPermission() {
  return false;
}

export async function ensureMicrophonePermission() {
  return false;
}

export async function requestLiveAvPermissions() {
  return { camera: false, microphone: false, notifications: false };
}

export async function requestNotificationPermission() {
  return false;
}

export async function microphoneAccess() {
  return "denied" as const;
}

export async function demanderMicro() {
  return false;
}

export function openAppSettings() {}

export type MicAccess = "granted" | "denied" | "blocked";
