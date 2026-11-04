import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { apiUpload, isVideoUrl, mediaUrl } from "@/src/api";
import {
    pickMediaLibrary,
    subscribePendingPickedMedia,
    type PickKind,
} from "@/src/pick-media";
import { colors, HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";
import type { ImagePickerAsset } from "expo-image-picker";

type Kind = PickKind;

async function uploadAsset(
  asset: { uri: string; fileName?: string | null; mimeType?: string | null },
  variant: "product" | "avatar",
) {
  const form = new FormData();
  appendUploadFile(form, asset);
  form.append("variant", variant);
  const uploaded = await apiUpload<{ url?: string; posterUrl?: string }>(
    "/api/upload",
    form,
  );
  const url = uploaded.url;
  if (!url) throw new Error("Média non reçu");
  return uploaded.posterUrl ? [uploaded.posterUrl, url] : [url];
}

export function MediaStrip({
  urls,
  onChange,
  max = 12,
  kind = "mixed",
  variant = "product",
  busy,
  setBusy,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  max?: number;
  kind?: Kind;
  variant?: "product" | "avatar";
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const c = useColors();
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const ingestRef = useRef<(assets: ImagePickerAsset[]) => Promise<void>>(
    async () => undefined,
  );
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"idle" | "picking" | "uploading">("idle");

  async function ingest(assets: ImagePickerAsset[]) {
    if (!assets.length) return;
    setPhase("uploading");
    setBusy(true);
    setDone(0);
    setTotal(assets.length);
    showToast("Média en cours d’envoi — patiente un instant.", "info");
    try {
      const next = max === 1 ? [] : [...urlsRef.current];
      let index = 0;
      for (const asset of assets) {
        if (next.length >= max) break;
        index += 1;
        setDone(index);
        const uploaded = await uploadAsset(asset, variant);
        for (const url of uploaded) {
          if (!next.includes(url) && next.length < max) next.push(url);
        }
      }
      urlsRef.current = next;
      onChange(next);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Import impossible",
        "error",
      );
    } finally {
      setBusy(false);
      setPhase("idle");
      setDone(0);
      setTotal(0);
    }
  }
  ingestRef.current = ingest;

  useEffect(() => {
    return subscribePendingPickedMedia((assets) => {
      void ingestRef.current(assets);
    });
  }, []);

  async function add(pickKind: Kind) {
    if (busy || phase !== "idle") {
      showToast("Patiente, le média se charge encore.", "info");
      return;
    }
    if (urls.length >= max && max !== 1) return;
    setPhase("picking");
    setBusy(true);
    try {
      const assets = await pickMediaLibrary({
        kind: pickKind,
        limit: max === 1 ? 1 : Math.max(1, max - urls.length),
        crop: false,
      });
      if (!assets.length) {
        setBusy(false);
        setPhase("idle");
        return;
      }
      await ingest(assets);
    } catch (cause) {
      setBusy(false);
      setPhase("idle");
      showToast(
        cause instanceof Error ? cause.message : "Import impossible",
        "error",
      );
    }
  }

  const replace = max === 1 && urls.length >= 1;
  const locked = busy || phase !== "idle";
  const full = locked || (urls.length >= max && max !== 1);
  const showPhotos = kind === "images" || kind === "mixed";
  const showVideos = kind === "videos" || kind === "mixed";
  const status =
    phase === "picking"
      ? "Ouverture de la galerie…"
      : total > 1
        ? `Envoi ${Math.min(done, total)}/${total} — patiente`
        : "Envoi du média — patiente un instant";

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        pointerEvents={locked ? "none" : "auto"}
      >
        {showPhotos ? (
          <Pressable
            style={[
              styles.add,
              {
                borderColor: HAIRLINE,
                backgroundColor: c.card,
              },
              locked && {
                borderColor: `${c.primary}88`,
                backgroundColor: `${c.primary}14`,
              },
            ]}
            onPress={() => void add("images")}
            disabled={full}
          >
            {locked ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Ionicons name="images-outline" size={24} color={c.text} />
            )}
            <Text style={[styles.addText, { color: c.text }]}>
              {locked
                ? "Chargement…"
                : replace
                  ? "Ajouter / remplacer"
                  : "Photos · 1 ou +"}
            </Text>
          </Pressable>
        ) : null}
        {showVideos ? (
          <Pressable
            style={[
              styles.add,
              {
                borderColor: HAIRLINE,
                backgroundColor: c.card,
              },
              locked && {
                borderColor: `${c.primary}88`,
                backgroundColor: `${c.primary}14`,
              },
            ]}
            onPress={() => void add("videos")}
            disabled={full}
          >
            {locked ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Ionicons name="videocam-outline" size={24} color={c.text} />
            )}
            <Text style={[styles.addText, { color: c.text }]}>
              {locked ? "Chargement…" : "Vidéos · 1 ou +"}
            </Text>
          </Pressable>
        ) : null}
        {phase === "uploading" ? (
          <View
            style={[
              styles.pending,
              {
                backgroundColor: `${c.primary}14`,
                borderColor: `${c.primary}55`,
              },
            ]}
          >
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.pendingText, { color: c.primary }]}>
              {total > 1 ? `${Math.min(done, total)}/${total}` : "…"}
            </Text>
          </View>
        ) : null}
        {urls.map((url) => (
          <View key={url} style={styles.thumbWrap}>
            <Image
              source={{ uri: mediaUrl(url) ?? url }}
              style={styles.thumb}
              contentFit="cover"
            />
            {isVideoUrl(url) ? (
              <View style={styles.play}>
                <Ionicons name="play" size={12} color="#fff" />
              </View>
            ) : null}
            <Pressable
              style={styles.remove}
              onPress={() => onChange(urls.filter((item) => item !== url))}
            >
              <Ionicons name="close" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {locked ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: `${c.primary}14`,
              borderColor: `${c.primary}55`,
            },
          ]}
          accessibilityRole="alert"
        >
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.bannerText, { color: c.text }]}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 4 },
  add: {
    width: 104,
    height: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  addText: {
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },
  pending: {
    width: 92,
    height: 112,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  pendingText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  banner: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },
  thumbWrap: { width: 92, height: 112 },
  thumb: { width: 92, height: 112, borderRadius: 16, backgroundColor: "#222" },
  play: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
});
