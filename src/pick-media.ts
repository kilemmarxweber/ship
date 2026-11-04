import { AppState, Platform } from "react-native";

import type { ImagePickerAsset } from "expo-image-picker";

export type PickKind = "images" | "videos" | "mixed";

type Picker = typeof import("expo-image-picker");

let pickerMod: Picker | null = null;

async function imagePicker(): Promise<Picker> {
  if (!pickerMod) {
    pickerMod = await import("expo-image-picker");
  }
  if (typeof pickerMod.launchImageLibraryAsync !== "function") {
    throw new Error(
      "Le sélecteur photo/vidéo sera actif après le build de développement.",
    );
  }
  return pickerMod;
}

function mediaTypesOf(kind: PickKind) {
  if (kind === "videos") return ["videos"] as const;
  if (kind === "images") return ["images"] as const;
  return ["images", "videos"] as const;
}

async function ensureIosLibraryPermission(ImagePicker: Picker) {
  if (Platform.OS !== "ios") return;
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted || current.accessPrivileges === "limited") return;
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!asked.granted && asked.accessPrivileges !== "limited") {
    throw new Error(
      "Autorise l’accès aux photos et vidéos pour parcourir tes fichiers.",
    );
  }
}

const consumedUris = new Set<string>();

function assetsFromUnknown(
  result: Awaited<ReturnType<Picker["getPendingResultAsync"]>>,
): ImagePickerAsset[] {
  if (!result || typeof result !== "object") return [];
  if ("canceled" in result && result.canceled) return [];
  if (!("assets" in result) || !Array.isArray(result.assets)) return [];
  const fresh: ImagePickerAsset[] = [];
  for (const asset of result.assets) {
    if (!asset?.uri) continue;
    if (consumedUris.has(asset.uri)) continue;
    consumedUris.add(asset.uri);
    fresh.push(asset);
  }
  return fresh;
}

export async function consumePendingPickedMedia(): Promise<ImagePickerAsset[]> {
  try {
    const ImagePicker = await imagePicker();
    return assetsFromUnknown(await ImagePicker.getPendingResultAsync());
  } catch {
    return [];
  }
}

export async function pickMediaLibrary(opts: {
  kind: PickKind;
  limit: number;
  crop?: boolean;
}) {
  const ImagePicker = await imagePicker();
  await ensureIosLibraryPermission(ImagePicker);

  const crop = Boolean(opts.crop);
  const remaining = Math.max(1, opts.limit);
  const multiple = !crop;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [...mediaTypesOf(opts.kind)],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? remaining : 1,
    quality: 0.85,
    videoMaxDuration: 60,
    orderedSelection: multiple,
    allowsEditing: crop && !multiple,
    aspect: crop ? [1, 1] : undefined,
    ...(Platform.OS === "android" && crop ? { legacy: true as const } : {}),
  });

  const picked = assetsFromUnknown(result);
  if (picked.length) return picked.slice(0, remaining);

  if (Platform.OS === "android") {
    const recovered = await consumePendingPickedMedia();
    if (recovered.length) return recovered.slice(0, remaining);
  }
  return [];
}

export function subscribePendingPickedMedia(
  onAssets: (assets: ImagePickerAsset[]) => void,
) {
  let alive = true;
  const pull = () => {
    void consumePendingPickedMedia().then((assets) => {
      if (alive && assets.length) onAssets(assets);
    });
  };
  pull();
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") pull();
  });
  return () => {
    alive = false;
    sub.remove();
  };
}
