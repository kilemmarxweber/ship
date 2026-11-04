import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isVideoUrl, mediaUrl } from "@/src/api";
import { colors } from "@/src/theme";
import { useToast, type ToastKind } from "@/src/toast";

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

const TINT: Record<ToastKind, string> = {
  success: colors.emerald,
  error: "#FF5A6A",
  info: "#8AB4FF",
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const id = useToast((state) => state.id);
  const message = useToast((state) => state.message);
  const kind = useToast((state) => state.kind);
  const action = useToast((state) => state.action);
  const hide = useToast((state) => state.hide);
  const holdMs = action ? 8000 : 4200;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, holdMs);
    return () => clearTimeout(timer);
  }, [id, message, hide, holdMs]);

  const cover = action?.image ? (mediaUrl(action.image) ?? action.image) : null;
  const video = Boolean(cover && isVideoUrl(cover));

  function open() {
    if (action?.href) {
      const href = action.href;
      hide();
      router.push(href);
      return;
    }
    hide();
  }

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {message ? (
        <Animated.View
          key={id}
          entering={FadeInDown.duration(260)}
          exiting={FadeOutUp.duration(180)}
          style={[
            styles.toast,
            Platform.OS === "ios" ? styles.ios : styles.android,
            { marginTop: Math.max(insets.top, 12) + 6 },
          ]}
        >
          <Pressable
            onPress={open}
            style={styles.inner}
            accessibilityRole={action ? "button" : "alert"}
            accessibilityHint={action ? "Voir la publication" : undefined}
          >
            {cover ? (
              <View style={styles.thumbWrap}>
                <Image
                  source={{ uri: cover }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                {video ? (
                  <View style={styles.play}>
                    <Ionicons name="play" size={10} color="#fff" />
                  </View>
                ) : null}
              </View>
            ) : (
              <Ionicons name={ICONS[kind]} size={22} color={TINT[kind]} />
            )}
            <View style={styles.copy}>
              <Text style={styles.text} numberOfLines={3}>
                {message}
              </Text>
              {action ? (
                <Text style={styles.cta}>
                  {action.label ?? "Touche pour voir"}
                </Text>
              ) : null}
            </View>
            {action ? (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.emerald}
              />
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    elevation: 80,
    alignItems: "center",
  },
  toast: {
    maxWidth: 420,
    width: "92%",
    backgroundColor: "rgba(22,22,28,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  ios: { borderRadius: 22 },
  android: { borderRadius: 16, elevation: 10 },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  thumb: { width: 48, height: 48 },
  play: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  text: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  cta: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800",
  },
});
