import { Image } from "expo-image";
import { Text, View } from "react-native";

import { mediaUrl } from "@/src/api";
import { useColors } from "@/src/use-colors";

export function Face({
  uri,
  name,
  size = 32,
  fallbackColor,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  fallbackColor?: string;
}) {
  const c = useColors();
  const source = mediaUrl(uri ?? null);
  const radius = size / 2;
  if (source) {
    return (
      <Image
        source={{ uri: source }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        accessibilityLabel={name}
      />
    );
  }
  const letter = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: fallbackColor ?? c.emerald,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontWeight: "700",
          fontSize: Math.round(size * 0.4),
        }}
      >
        {letter}
      </Text>
    </View>
  );
}
