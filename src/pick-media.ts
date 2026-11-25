import { Alert, AppState, Platform } from "react-native";

import type { ImagePickerAsset } from "expo-image-picker";

export type PickKind = "images" | "videos" | "mixed";
export type CameraPickKind = "images" | "videos";
export type MediaSourceChoice = "camera-photo" | "camera-video" | "import";

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
    // Android : le sélecteur système permet de parcourir Fichiers, pas seulement la galerie.
    ...(Platform.OS === "android" ? { legacy: true as const } : {}),
  });

  const picked = await settlePickedFiles(assetsFromUnknown(result));
  if (picked.length) return picked.slice(0, remaining);

  if (Platform.OS === "android") {
    const recovered = await settlePickedFiles(
      await consumePendingPickedMedia(),
    );
    if (recovered.length) return recovered.slice(0, remaining);
  }
  return [];
}

const UNREADABLE =
  "Ce fichier n’est pas enregistré sur le téléphone. Télécharge-le, puis réessaie.";

function mimeOf(name: string, mime?: string | null) {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("image/") || type.startsWith("video/")) return type;
  if (/\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(name)) return "video/mp4";
  if (/\.(png)$/i.test(name)) return "image/png";
  if (/\.(webp)$/i.test(name)) return "image/webp";
  if (/\.(gif)$/i.test(name)) return "image/gif";
  if (/\.(heic|heif)$/i.test(name)) return "image/heic";
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  return "";
}

function extensionOf(name: string, mime: string) {
  const fromName = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  if (fromName === "jpeg") return ".jpg";
  if (fromName) return `.${fromName}`;
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("heic") || mime.includes("heif")) return ".heic";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.startsWith("video/")) return ".mp4";
  if (mime.startsWith("image/")) return ".jpg";
  return "";
}

function accepts(kind: PickKind, mime: string) {
  if (kind === "videos") return mime.startsWith("video/");
  if (kind === "images") return mime.startsWith("image/");
  return mime.startsWith("image/") || mime.startsWith("video/");
}

function browseMime(kind: PickKind) {
  if (kind === "videos") return "video/*";
  if (kind === "images") return "image/*";
  return "*/*";
}

function asFileUri(uri: string) {
  if (uri.startsWith("file://") || uri.startsWith("content://")) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

/** Copie le fichier choisi dans le cache de l’app tant que l’accès Android est encore valide. */
async function readableLocalUri(uri: string, name: string, mime: string) {
  const FS = await import("expo-file-system/legacy");
  const sourceUri = asFileUri(uri);
  if (!FS.cacheDirectory || typeof FS.copyAsync !== "function") {
    if (sourceUri.startsWith("file://") || sourceUri.startsWith("blob:")) {
      return sourceUri;
    }
    throw new Error(UNREADABLE);
  }
  if (sourceUri.startsWith("file://")) {
    const current = await FS.getInfoAsync(sourceUri);
    if (current.exists && (current.size ?? 0) > 0) return sourceUri;
  }
  const dest = `${FS.cacheDirectory}pick-${Date.now()}-${Math.floor(Math.random() * 1e9)}${extensionOf(name, mime)}`;
  await FS.copyAsync({ from: sourceUri, to: dest });
  const copied = await FS.getInfoAsync(dest);
  if (!copied.exists || (copied.size ?? 0) <= 0) throw new Error(UNREADABLE);
  return asFileUri(dest);
}

async function settlePickedFiles(assets: ImagePickerAsset[]) {
  const settled: ImagePickerAsset[] = [];
  for (const asset of assets) {
    if (!asset.uri) continue;
    const name = asset.fileName ?? asset.uri.split("/").pop() ?? "media";
    const mime = mimeOf(name, asset.mimeType) || asset.mimeType || "image/jpeg";
    const uri = await readableLocalUri(asset.uri, name, mime);
    settled.push({
      ...asset,
      uri,
      fileName: name,
      mimeType: mime,
    });
  }
  return settled;
}

type BrowseHit = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  file?: Blob | null;
};

async function browseWithDocumentPicker(
  kind: PickKind,
  remaining: number,
): Promise<BrowseHit[]> {
  const DocumentPicker = await import("expo-document-picker");
  const result = await DocumentPicker.getDocumentAsync({
    type: browseMime(kind),
    copyToCacheDirectory: true,
    multiple: remaining > 1,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, remaining).map((file) => ({
    uri: file.uri,
    name: file.name || "media",
    mimeType: file.mimeType,
    size: file.size,
    file: file.file,
  }));
}

/** Un seul parcours : photos, vidéos, une ou plusieurs. */
export async function pickBrowseFiles(opts: { kind: PickKind; limit: number }) {
  const remaining = Math.max(1, opts.limit);
  const picked = await browseWithDocumentPicker(opts.kind, remaining);
  if (!picked.length) return [];
  const assets: (ImagePickerAsset & { file?: Blob | null })[] = [];
  for (const file of picked) {
    if (!file.uri) throw new Error(UNREADABLE);
    const mime = mimeOf(file.name, file.mimeType);
    if (!accepts(opts.kind, mime)) continue;
    const uri = await readableLocalUri(file.uri, file.name, mime);
    assets.push({
      uri,
      width: 0,
      height: 0,
      fileName: file.name,
      mimeType: mime,
      fileSize: file.size ?? undefined,
      type: mime.startsWith("video/") ? "video" : "image",
      file: (file.file ?? undefined) as ImagePickerAsset["file"],
    });
  }
  if (!assets.length) {
    throw new Error("Choisis une photo ou une vidéo.");
  }
  return assets;
}

async function ensureCameraPermission(ImagePicker: Picker) {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return;
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  if (!asked.granted) {
    throw new Error("Autorise la caméra pour prendre une photo ou une vidéo.");
  }
}

async function ensureMicForVideo() {
  try {
    const Audio = await import("expo-audio");
    const current = await Audio.getRecordingPermissionsAsync();
    if (current.granted) return;
    const asked = await Audio.requestRecordingPermissionsAsync();
    if (!asked.granted) {
      throw new Error("Autorise le micro pour filmer une vidéo.");
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Autorise")) {
      throw cause;
    }
    // Module audio indisponible : la caméra système demandera le micro.
  }
}

function cameraFileMeta(kind: CameraPickKind) {
  if (kind === "videos") {
    return { fileName: "camera.mp4", mimeType: "video/mp4" as const };
  }
  return { fileName: "camera.jpg", mimeType: "image/jpeg" as const };
}

/** Capture caméra (photo ou vidéo). Noms stables pour l’upload. */
export async function pickFromCamera(opts: {
  kind: CameraPickKind;
  facing?: "back" | "front";
  /** Durée max vidéo caméra (15 / 30 / 60). Défaut 60. */
  videoMaxDuration?: number;
}) {
  const ImagePicker = await imagePicker();
  if (typeof ImagePicker.launchCameraAsync !== "function") {
    throw new Error("La caméra sera active après le build de développement.");
  }
  await ensureCameraPermission(ImagePicker);
  if (opts.kind === "videos") await ensureMicForVideo();

  const meta = cameraFileMeta(opts.kind);
  const facing = opts.facing ?? "back";
  const maxSeconds = Math.min(
    60,
    Math.max(1, Math.round(opts.videoMaxDuration ?? 60)),
  );
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: [...mediaTypesOf(opts.kind)],
    quality: 0.85,
    videoMaxDuration: maxSeconds,
    cameraType:
      facing === "front"
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  });

  let assets = assetsFromUnknown(result);
  if (!assets.length && Platform.OS === "android") {
    assets = await consumePendingPickedMedia();
  }
  if (!assets.length) return [];

  const settled = await settlePickedFiles(
    assets.map((asset) => ({
      ...asset,
      fileName: asset.fileName || meta.fileName,
      mimeType:
        mimeOf(asset.fileName || meta.fileName, asset.mimeType) ||
        meta.mimeType,
    })),
  );
  return settled.slice(0, 1).map((asset) => ({
    ...asset,
    fileName: meta.fileName,
    mimeType: mimeOf(meta.fileName, asset.mimeType) || meta.mimeType,
    type: opts.kind === "videos" ? ("video" as const) : ("image" as const),
  }));
}

/** Choix Caméra photo / Caméra vidéo / Import (ActionSheet système). */
export function promptMediaSource(opts: {
  allowPhoto?: boolean;
  allowVideo?: boolean;
  title?: string;
  photoLabel?: string;
  videoLabel?: string;
  importLabel?: string;
  cancelLabel?: string;
}): Promise<MediaSourceChoice | null> {
  const allowPhoto = opts.allowPhoto !== false;
  const allowVideo = opts.allowVideo !== false;
  return new Promise((resolve) => {
    const buttons: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[] = [];
    if (allowPhoto) {
      buttons.push({
        text: opts.photoLabel ?? "Prendre une photo",
        onPress: () => resolve("camera-photo"),
      });
    }
    if (allowVideo) {
      buttons.push({
        text: opts.videoLabel ?? "Filmer une vidéo",
        onPress: () => resolve("camera-video"),
      });
    }
    buttons.push({
      text: opts.importLabel ?? "Importer (galerie / fichiers)",
      onPress: () => resolve("import"),
    });
    buttons.push({
      text: opts.cancelLabel ?? "Annuler",
      style: "cancel",
      onPress: () => resolve(null),
    });
    Alert.alert(opts.title ?? "Ajouter un média", undefined, buttons, {
      cancelable: true,
      onDismiss: () => resolve(null),
    });
  });
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
