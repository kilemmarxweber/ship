import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { qrImageUrl } from "@/src/handover";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

function fileSlug(url: string) {
  const part = url.split("/shop/")[1]?.split(/[?#]/)[0] ?? "boutique";
  return part.replace(/[^\w.-]+/g, "-").slice(0, 48) || "boutique";
}

async function shareOnWeb(imageUrl: string, name: string, pageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("qr");
  const blob = await response.blob();
  const file = new File([blob], "boutique-qr.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name, text: pageUrl });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: name, text: pageUrl, url: pageUrl });
    return;
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "boutique-qr.png";
  link.click();
  URL.revokeObjectURL(href);
}

export function ShopQrButton({
  shopUrl,
  shopName,
  iconColor,
  bare = false,
  style,
}: {
  shopUrl: string;
  shopName: string;
  iconColor?: string;
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const imageUrl = qrImageUrl(shopUrl, 720, 28);
  const color = iconColor ?? c.text;

  async function shareCode() {
    if (sharing) return;
    setSharing(true);
    try {
      if (Platform.OS === "web") {
        await shareOnWeb(imageUrl, shopName, shopUrl);
        return;
      }
      const FileSystem = await import("expo-file-system/legacy");
      const dest = `${FileSystem.cacheDirectory ?? ""}shop-qr-${fileSlug(shopUrl)}.png`;
      const file = await FileSystem.downloadAsync(imageUrl, dest);
      await Share.share(
        Platform.OS === "ios"
          ? { url: file.uri, message: `${shopName}\n${shopUrl}` }
          : { title: shopName, message: `${shopName}\n${shopUrl}` },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/cancel|dismiss|abort/i.test(message)) return;
      showToast("Partage impossible pour le moment.", "error");
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Code QR de la boutique"
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={[
          bare ? styles.bare : styles.iconBtn,
          !bare && {
            borderColor: "rgba(127,127,140,0.22)",
            backgroundColor: c.card,
          },
          style,
        ]}
      >
        <Ionicons name="qr-code-outline" size={18} color={color} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: c.sheet,
                marginBottom: insets.bottom,
              },
            ]}
            onPress={() => undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              hitSlop={8}
              onPress={() => setOpen(false)}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={c.text} />
            </Pressable>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
              {shopName}
            </Text>
            <View style={styles.frame}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.qr}
                contentFit="contain"
                accessibilityLabel={`Code QR de ${shopName}`}
              />
            </View>
            <Text style={[styles.hint, { color: c.textMuted }]}>
              Colle ce code au mur. Un scan ouvre la boutique et son catalogue.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Partager le code QR"
              disabled={sharing}
              onPress={() => void shareCode()}
              style={[styles.share, { backgroundColor: c.primary }]}
            >
              {sharing ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <>
                  <Ionicons
                    name="share-outline"
                    size={18}
                    color={c.primaryForeground}
                  />
                  <Text
                    style={[styles.shareText, { color: c.primaryForeground }]}
                  >
                    Partager le code
                  </Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  bare: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
    gap: 12,
  },
  close: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 36,
  },
  frame: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,140,0.22)",
  },
  qr: { width: 240, height: 240 },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  share: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareText: { fontSize: 16, fontWeight: "800" },
});
