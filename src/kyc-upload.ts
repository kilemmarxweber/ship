import { Platform } from "react-native";

import { apiUpload } from "@/src/api";
import { appendUploadFile } from "@/src/upload-file";

async function imagePicker() {
  const ImagePicker = await import("expo-image-picker");
  if (typeof ImagePicker.launchImageLibraryAsync !== "function") {
    throw new Error(
      "Caméra et galerie actives après le build de développement.",
    );
  }
  return ImagePicker;
}

async function uploadImage(uri: string, name: string) {
  const form = new FormData();
  await appendUploadFile(form, { uri, fileName: name, mimeType: "image/jpeg" });
  form.append("variant", "document");
  const uploaded = await apiUpload<{ url?: string }>("/api/upload", form);
  if (!uploaded.url) throw new Error("Média non reçu");
  return uploaded.url;
}

export async function pickKycFromLibrary() {
  const ImagePicker = await imagePicker();
  if (Platform.OS === "ios") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.accessPrivileges !== "limited") {
      throw new Error("Autorise l’accès aux photos.");
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  let uri = result.canceled ? undefined : result.assets?.[0]?.uri;
  if (!uri) {
    const pending = await ImagePicker.getPendingResultAsync();
    if (pending && "assets" in pending) uri = pending.assets?.[0]?.uri;
  }
  if (!uri) return null;
  return uploadImage(uri, "kyc.jpg");
}

export async function captureKycPhoto(facing: "front" | "back") {
  const ImagePicker = await imagePicker();
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Autorise la caméra pour le KYC.");
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    cameraType:
      facing === "front"
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  });
  let uri = result.canceled ? undefined : result.assets?.[0]?.uri;
  if (!uri) {
    const pending = await ImagePicker.getPendingResultAsync();
    if (pending && "assets" in pending) uri = pending.assets?.[0]?.uri;
  }
  if (!uri) return null;
  return uploadImage(uri, "kyc-camera.jpg");
}
