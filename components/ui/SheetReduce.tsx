import { Pressable, StyleSheet, View } from "react-native";

/** Poignée seule en haut du sheet — ferme / réduit au tap (sans libellé). */
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
    minHeight: 36,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
});
