import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import type { LiveLookId } from "@/src/live-look";

export function LiveFilterOverlay({ look }: { look: LiveLookId }) {
  if (look === "naturel") return null;
  return (
    <View style={styles.fill} pointerEvents="none">
      {look === "studio" ? (
        <LinearGradient
          colors={[
            "rgba(255,236,214,0.28)",
            "transparent",
            "rgba(255,248,240,0.18)",
          ]}
          style={styles.fill}
        />
      ) : null}
      {look === "doux" ? (
        <View
          style={[styles.fill, { backgroundColor: "rgba(255,248,242,0.22)" }]}
        />
      ) : null}
      {look === "vivid" ? (
        <LinearGradient
          colors={[
            "rgba(255,92,40,0.16)",
            "transparent",
            "rgba(40,90,255,0.14)",
          ]}
          style={styles.fill}
        />
      ) : null}
      {look === "cinema" ? (
        <>
          <LinearGradient
            colors={[
              "rgba(255,140,64,0.2)",
              "transparent",
              "rgba(12,70,78,0.28)",
            ]}
            style={styles.fill}
          />
          <View style={styles.letterTop} />
          <View style={styles.letterBottom} />
        </>
      ) : null}
      {look === "noir" ? (
        <View
          style={[styles.fill, { backgroundColor: "rgba(10,10,14,0.42)" }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  letterTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 42,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  letterBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 42,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
