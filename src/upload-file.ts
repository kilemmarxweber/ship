export type UploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  opus: "audio/opus",
  weba: "audio/webm",
};

function extFrom(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] ?? "";
  return ext === "jpeg" ? "jpg" : ext;
}

export function guessUploadMeta(asset: UploadAsset) {
  const fromUri = asset.uri.split("?")[0] ?? "";
  let ext = extFrom(asset.fileName ?? "") || extFrom(fromUri);
  let type = (asset.mimeType ?? "").toLowerCase().trim();
  if (type === "image/jpg") type = "image/jpeg";
  if (
    !type ||
    type === "image" ||
    type === "video" ||
    type === "application/octet-stream" ||
    type === "image/*" ||
    type === "video/*"
  ) {
    type = EXT_MIME[ext] ?? "image/jpeg";
  }
  if (!ext) {
    if (type.includes("png")) ext = "png";
    else if (type.includes("webp")) ext = "webp";
    else if (type.includes("gif")) ext = "gif";
    else if (type.includes("heic") || type.includes("heif")) ext = "heic";
    else if (type.includes("webm")) ext = "webm";
    else if (type.includes("quicktime") || type.includes("mov")) ext = "mov";
    else if (type.startsWith("video/")) ext = "mp4";
    else if (type.includes("mpeg") || type === "audio/mp3") ext = "mp3";
    else if (type.includes("aac")) ext = "aac";
    else if (type.includes("wav")) ext = "wav";
    else if (type.includes("ogg")) ext = "ogg";
    else if (type.includes("flac")) ext = "flac";
    else if (type.startsWith("audio/")) ext = "m4a";
    else ext = "jpg";
  }
  const given = asset.fileName?.trim() ?? "";
  const name = given && extFrom(given) ? given : `media.${ext}`;
  return { name, type };
}

/** Partie fichier React Native — ne pas caster en Blob (fetch refuse). */
export function appendUploadFile(form: FormData, asset: UploadAsset) {
  const { name, type } = guessUploadMeta(asset);
  form.append("file", { uri: asset.uri, name, type } as never);
  return { name, type };
}
