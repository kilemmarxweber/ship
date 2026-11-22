import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { safeBack } from "@/src/nav";

type Props = {
  onPress?: () => void;
  color?: string;
  fallback?: Href;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Chevron seul, cible 44 pt. Le libellé reste pour le lecteur d’écran. */
export function IconBackButton({
  onPress,
  color = "#F5F7FA",
  fallback,
  accessibilityLabel = "Retour",
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      onPress={onPress ?? (() => safeBack(fallback))}
      style={[styles.hit, style]}
    >
      <Ionicons name="chevron-back" size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
});
