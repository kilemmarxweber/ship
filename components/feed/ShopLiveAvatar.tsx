import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { mediaUrl } from "@/src/api";
import { colors } from "@/src/theme";

export function ShopLiveAvatar({
  live,
  logoUrl,
  name,
  size = 28,
  onPress,
}: {
  live: boolean;
  logoUrl?: string | null;
  name: string;
  size?: number;
  onPress: () => void;
}) {
  const tick = useSharedValue(0);
  const ringColor = live ? colors.live : colors.emerald;

  useEffect(() => {
    tick.value = 0;
    tick.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(tick);
  }, [tick]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(tick.value, [0, 0.5, 1], [1, 1.07, 1]) }],
    shadowOpacity: interpolate(tick.value, [0, 0.5, 1], [0.18, 0.75, 0.18]),
    shadowRadius: interpolate(tick.value, [0, 0.5, 1], [2, 9, 2]),
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: live
      ? interpolate(tick.value, [0, 0.42, 0.5, 0.92, 1], [1, 1, 0, 0, 1])
      : 1,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: live
      ? interpolate(tick.value, [0, 0.42, 0.5, 0.92, 1], [0, 0, 1, 1, 0])
      : 0,
  }));

  const radius = size / 2;
  const letter = name.trim().slice(0, 1).toUpperCase() || "S";
  const uri = mediaUrl(logoUrl ?? undefined);

  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: 2,
            borderColor: ringColor,
            backgroundColor: "#222",
            overflow: "hidden",
            shadowColor: ringColor,
          },
          ringStyle,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={styles.fallback}>
              <Text style={[styles.letter, { fontSize: size * 0.38 }]}>
                {letter}
              </Text>
            </View>
          )}
        </Animated.View>
        {live ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.label, labelStyle]}
          >
            <Text style={[styles.live, { fontSize: Math.max(8, size * 0.26) }]}>
              LIVE
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
  },
  letter: { color: "#fff", fontWeight: "800" },
  label: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.live,
  },
  live: { color: "#fff", fontWeight: "800", letterSpacing: 0.4 },
});
