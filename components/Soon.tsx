import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme";

export function Soon({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  text: { color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 22 },
});
