import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme";

/** Poignée + « Réduire » centrés en haut des bottom sheets. */
export function SheetReduce({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={styles.hit}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Réduire"
      hitSlop={12}
    >
      <View style={styles.handle} />
      <View style={styles.row}>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
        <Text style={styles.label}>Réduire</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
    minHeight: 52,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
