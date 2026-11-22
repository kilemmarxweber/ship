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

import {
    ProductImageEditorSheet,
    type MontageMedia,
    type MontageSave,
} from "@/components/publish/ProductImageEditorSheet";
import { ProductImagePreviewSheet } from "@/components/publish/ProductImagePreviewSheet";
import { api, apiUpload, isVideoUrl, mediaUrl } from "@/src/api";
import {
    pickBrowseFiles,
    pickMediaLibrary,
    subscribePendingPickedMedia,
    type PickKind,
} from "@/src/pick-media";
import {
    analyzeProductImage,
    formatRatio,
    hintFromSellCategory,
    sortPrimaryFirst,
    type ProductImageMeta,
} from "@/src/product-image-intel";
import { colors, HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";
import type { ImagePickerAsset } from "expo-image-picker";

type Kind = PickKind;

async function uploadAsset(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    file?: Blob | null;
  },
  variant: "product" | "avatar",
) {
  const form = new FormData();
  await appendUploadFile(form, asset);
  form.append("variant", variant);
  const uploaded = await apiUpload<{ url?: string; posterUrl?: string }>(
    "/api/upload",
    form,
  );
  const url = uploaded.url;
  if (!url) throw new Error("Média non reçu");
  return uploaded.posterUrl ? [uploaded.posterUrl, url] : [url];
}

async function optimizeStill(uri: string): Promise<string> {
  try {
    const ImageManipulator = await import("expo-image-manipulator");
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri || uri;
  } catch {
    return uri;
  }
}

export function MediaStrip({
  urls,
  onChange,
  max = 12,
  kind = "mixed",
  variant = "product",
  busy,
  setBusy,
  category = "divers",
  shopLogoUrl,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  max?: number;
  kind?: Kind;
  variant?: "product" | "avatar";
  busy: boolean;
  setBusy: (value: boolean) => void;
  category?: string;
  shopLogoUrl?: string | null;
}) {
  const c = useColors();
  const urlsRef = useRef(urls);
  const ingestRef = useRef<(assets: ImagePickerAsset[]) => Promise<void>>(
    async () => undefined,
  );
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"idle" | "picking" | "uploading">("idle");
  const [metas, setMetas] = useState<ProductImageMeta[]>([]);
  const [preview, setPreview] = useState<ProductImageMeta | null>(null);
  const [editing, setEditing] = useState<ProductImageMeta | null>(null);
  const categoryHint = hintFromSellCategory(category);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next: ProductImageMeta[] = [];
      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        if (isVideoUrl(url)) {
          next.push({
            url,
            originalUrl: url,
            width: 0,
            height: 0,
            ratio: 1,
            fit: "contain",
            isPrimary: i === 0,
          });
          continue;
        }
        const existing = metas.find(
          (item) => item.url === url || item.originalUrl === url,
        );
        if (existing) {
          next.push({ ...existing, isPrimary: i === 0 });
          continue;
        }
        try {
          const uri = mediaUrl(url) ?? url;
          const meta = await analyzeProductImage(uri, {
            categoryHint,
            isPrimary: i === 0,
            originalUrl: url,
          });
          next.push({ ...meta, url });
        } catch {
          next.push({
            url,
            originalUrl: url,
            width: 0,
            height: 0,
            ratio: 1,
            fit: "contain",
            isPrimary: i === 0,
            tip: "Contain par défaut — proportions respectées.",
          });
        }
      }
      if (alive) setMetas(sortPrimaryFirst(next));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-analyse when urls/category change
  }, [urls.join("|"), categoryHint]);

  async function ingest(assets: ImagePickerAsset[]) {
    if (!assets.length) return;
    setPhase("uploading");
    setBusy(true);
    setDone(0);
    setTotal(assets.length);
    try {
      const next = max === 1 ? [] : [...urlsRef.current];
      let index = 0;
      for (const asset of assets) {
        if (next.length >= max) break;
        index += 1;
        setDone(index);
        const isVideo = (asset.type ?? "").includes("video");
        let uploadUri = asset.uri;
        if (!isVideo && variant === "product") {
          uploadUri = await optimizeStill(asset.uri);
        }
        const uploaded = await uploadAsset(
          { ...asset, uri: uploadUri },
          variant,
        );
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
  useEffect(() => {
    ingestRef.current = ingest;
  });

  useEffect(() => {
    return subscribePendingPickedMedia((assets) => {
      void ingestRef.current(assets);
    });
  }, []);

  async function add() {
    if (busy || phase !== "idle") {
      showToast("Patiente, le média se charge encore.", "info");
      return;
    }
    if (urls.length >= max && max !== 1) return;
    setPhase("picking");
    setBusy(true);
    try {
      const limit = max === 1 ? 1 : Math.max(1, max - urls.length);
      const assets = await pickBrowseFiles({ kind, limit });
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

  function setPrimary(url: string) {
    const next = [url, ...urls.filter((item) => item !== url)];
    onChange(next);
    showToast("Photo principale définie", "info");
  }

  async function replaceOne(url: string) {
    setPreview(null);
    setPhase("picking");
    setBusy(true);
    try {
      const assets = await pickMediaLibrary({
        kind: "images",
        limit: 1,
        crop: false,
      });
      if (!assets.length) {
        setBusy(false);
        setPhase("idle");
        return;
      }
      setPhase("uploading");
      const optimized = await optimizeStill(assets[0].uri);
      const uploaded = await uploadAsset(
        { ...assets[0], uri: optimized },
        variant,
      );
      const replacement = uploaded[0];
      onChange(urls.map((item) => (item === url ? replacement : item)));
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Remplacement impossible",
        "error",
      );
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  async function cropOne(url: string) {
    setPreview(null);
    setPhase("picking");
    setBusy(true);
    try {
      const assets = await pickMediaLibrary({
        kind: "images",
        limit: 1,
        crop: true,
      });
      if (!assets.length) {
        setBusy(false);
        setPhase("idle");
        return;
      }
      setPhase("uploading");
      const uploaded = await uploadAsset(assets[0], variant);
      const cropped = uploaded[0];
      // Keep original earlier in list semantics: display uses cropped url,
      // originalUrl stays in meta via analyze on next effect.
      onChange(urls.map((item) => (item === url ? cropped : item)));
      showToast(
        "Recadrage appliqué — l’original reste sur le serveur si déjà envoyé",
        "info",
      );
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Recadrage impossible",
        "error",
      );
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  const replace = max === 1 && urls.length >= 1;
  const locked = busy || phase !== "idle";
  const full = locked || (urls.length >= max && max !== 1);
  const montageTarget = urls[0] ?? null;
  const montageMedias: MontageMedia[] = urls.map((url) => {
    const meta = metas.find((item) => item.url === url);
    const video = isVideoUrl(url);
    const ratio =
      meta?.ratio && meta.ratio > 0 ? meta.ratio : video ? 9 / 16 : 1;
    return {
      url,
      uri: mediaUrl(url) ?? url,
      video,
      width: meta?.width ?? 0,
      ratio,
    };
  });
  const browseLabel =
    kind === "videos"
      ? "Vidéos · 1 ou +"
      : kind === "images"
        ? "Photos · 1 ou +"
        : "Photos ou vidéos";
  const status =
    phase === "picking"
      ? "Ouverture des fichiers…"
      : total > 1
        ? `Envoi ${Math.min(done, total)}/${total}`
        : "Analyse + envoi…";

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        pointerEvents={locked ? "none" : "auto"}
      >
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
          onPress={() => void add()}
          disabled={full}
          accessibilityLabel={`Parcourir ${browseLabel}`}
        >
          {locked ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <Ionicons name="folder-open-outline" size={24} color={c.text} />
          )}
          <Text style={[styles.addText, { color: c.text }]}>
            {locked ? "Chargement…" : replace ? "Remplacer" : "Parcourir"}
          </Text>
          {locked ? null : (
            <Text style={[styles.addHint, { color: c.muted }]}>
              {browseLabel}
            </Text>
          )}
        </Pressable>
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
        {urls.map((url, index) => {
          const meta = metas.find((item) => item.url === url);
          const primary = index === 0;
          return (
            <Pressable
              key={url}
              style={styles.thumbWrap}
              onPress={() => {
                if (meta) setPreview(meta);
                else
                  setPreview({
                    url,
                    originalUrl: url,
                    width: 0,
                    height: 0,
                    ratio: 1,
                    fit: "contain",
                    isPrimary: primary,
                  });
              }}
            >
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
              {primary ? (
                <View style={[styles.badge, { backgroundColor: c.emerald }]}>
                  <Text style={styles.badgeText}>1</Text>
                </View>
              ) : null}
              {meta?.warning ? (
                <View style={styles.warnDot}>
                  <Ionicons name="warning" size={10} color="#04281c" />
                </View>
              ) : null}
              {meta && meta.width > 0 ? (
                <View style={styles.ratioTag}>
                  <Text style={styles.ratioText}>
                    {formatRatio(meta.ratio)}
                  </Text>
                </View>
              ) : null}
              <Pressable
                style={styles.remove}
                onPress={(event) => {
                  event.stopPropagation?.();
                  onChange(urls.filter((item) => item !== url));
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </Pressable>
          );
        })}
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

      {variant === "product" ? (
        <Pressable
          style={[
            styles.montageButton,
            {
              backgroundColor: c.card,
              borderColor: `${c.primary}66`,
              opacity: montageTarget && !locked ? 1 : 0.5,
            },
          ]}
          disabled={!montageTarget || locked}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le montage du produit"
          onPress={() => {
            if (!montageTarget) return;
            const meta = metas.find((item) => item.url === montageTarget);
            setEditing(
              meta ?? {
                url: montageTarget,
                originalUrl: montageTarget,
                width: 0,
                height: 0,
                ratio: isVideoUrl(montageTarget) ? 9 / 16 : 1,
                fit: "contain",
                isPrimary: true,
              },
            );
          }}
        >
          <Ionicons name="color-wand-outline" size={18} color={c.primary} />
          <Text style={[styles.montageText, { color: c.text }]}>
            Montage du produit
          </Text>
        </Pressable>
      ) : null}

      <ProductImagePreviewSheet
        open={Boolean(preview)}
        meta={preview}
        onClose={() => setPreview(null)}
        onEdit={() => {
          setEditing(preview);
          setPreview(null);
        }}
        onSetPrimary={() => {
          if (preview) setPrimary(preview.url);
          setPreview(null);
        }}
        onCrop={() => {
          if (preview) void cropOne(preview.url);
        }}
        onReplace={() => {
          if (preview) void replaceOne(preview.url);
        }}
        onRemove={() => {
          if (preview) onChange(urls.filter((item) => item !== preview.url));
          setPreview(null);
        }}
      />
      {editing ? (
        <ProductImageEditorSheet
          key={editing.url}
          open
          medias={montageMedias}
          initialUrl={editing.url}
          logoUri={mediaUrl(shopLogoUrl) ?? shopLogoUrl}
          onClose={() => setEditing(null)}
          onSave={async (result: MontageSave) => {
            setPhase("uploading");
            setBusy(true);
            try {
              let replacement = "";
              if (result.kind === "video") {
                const captioned = await api<{ url?: string }>(
                  "/api/media/caption",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      url: result.targetUrl,
                      text: result.text,
                      position: result.position,
                      size: result.size,
                    }),
                  },
                );
                replacement = captioned.url ?? "";
                if (!replacement) throw new Error("Vidéo retouchée non reçue");
              } else {
                const uploaded = await uploadAsset(
                  {
                    uri: result.uri,
                    fileName: "retouched-product.jpg",
                    mimeType: "image/jpeg",
                    file: result.file,
                  },
                  variant,
                );
                replacement = uploaded[0] ?? "";
              }
              if (!replacement) throw new Error("Média non reçu");
              urlsRef.current = urlsRef.current.map((url) =>
                url === result.targetUrl ? replacement : url,
              );
              onChange(urlsRef.current);
              return true;
            } catch (cause) {
              showToast(
                cause instanceof Error ? cause.message : "Retouche impossible",
                "error",
              );
              return false;
            } finally {
              setBusy(false);
              setPhase("idle");
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 4 },
  add: {
    width: 124,
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
    fontSize: 12,
    textAlign: "center",
  },
  addHint: {
    fontWeight: "600",
    fontSize: 10,
    textAlign: "center",
    paddingHorizontal: 6,
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
  montageButton: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  montageText: { fontSize: 13, fontWeight: "700" },
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
  badge: {
    position: "absolute",
    left: 6,
    top: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#04281c", fontWeight: "900", fontSize: 11 },
  warnDot: {
    position: "absolute",
    right: 28,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FBBF24",
    alignItems: "center",
    justifyContent: "center",
  },
  ratioTag: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratioText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
  footTip: { marginTop: 8, fontSize: 12, lineHeight: 17 },
});
