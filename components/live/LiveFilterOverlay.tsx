import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import type { LiveLookId } from "@/src/live-look";

/**
 * Filtres « studio » en overlay (sans SDK beauté natif).
 * Soft light + chaleur peau + vignette pour un rendu plus propre.
 */
export function LiveFilterOverlay({
  look,
  intensity = "full",
}: {
  look: LiveLookId;
  intensity?: "full" | "pip";
}) {
  if (look === "naturel") return null;
  const pip = intensity === "pip";
  const soft = pip ? 0.55 : 1;

  return (
    <View style={styles.fill} pointerEvents="none">
      {look === "studio" ? (
        <>
          {/* Key light chaud (teint / visage) */}
          <LinearGradient
            colors={[
              `rgba(255,236,214,${0.34 * soft})`,
              `rgba(255,248,240,${0.08 * soft})`,
              "transparent",
            ]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 0.55 }}
            style={styles.fill}
          />
          {/* Soft fill bas */}
          <LinearGradient
            colors={[
              "transparent",
              `rgba(255,250,245,${0.16 * soft})`,
              `rgba(20,16,12,${0.22 * soft})`,
            ]}
            style={styles.fill}
          />
          {/* Vignette douce */}
          <LinearGradient
            colors={[
              `rgba(8,6,4,${0.28 * soft})`,
              "transparent",
              "transparent",
              `rgba(8,6,4,${0.32 * soft})`,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
          {/* Halo central « peau » */}
          {!pip ? <View style={styles.skinGlow} /> : null}
        </>
      ) : null}

      {look === "doux" ? (
        <>
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,248,242,${0.2 * soft})` },
            ]}
          />
          <LinearGradient
            colors={[
              `rgba(255,220,210,${0.18 * soft})`,
              "transparent",
              `rgba(255,240,230,${0.12 * soft})`,
            ]}
            style={styles.fill}
          />
          <LinearGradient
            colors={[
              `rgba(30,20,18,${0.2 * soft})`,
              "transparent",
              `rgba(30,20,18,${0.24 * soft})`,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
        </>
      ) : null}

      {look === "vivid" ? (
        <LinearGradient
          colors={[
            `rgba(255,92,40,${0.14 * soft})`,
            "transparent",
            `rgba(40,90,255,${0.12 * soft})`,
          ]}
          style={styles.fill}
        />
      ) : null}

      {look === "cinema" ? (
        <>
          <LinearGradient
            colors={[
              `rgba(255,140,64,${0.16 * soft})`,
              "transparent",
              `rgba(12,70,78,${0.24 * soft})`,
            ]}
            style={styles.fill}
          />
          {!pip ? (
            <>
              <View style={styles.letterTop} />
              <View style={styles.letterBottom} />
            </>
          ) : null}
        </>
      ) : null}

      {look === "noir" ? (
        <View
          style={[
            styles.fill,
            { backgroundColor: `rgba(10,10,14,${0.38 * soft})` },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  skinGlow: {
    position: "absolute",
    top: "18%",
    left: "12%",
    right: "12%",
    height: "42%",
    borderRadius: 999,
    backgroundColor: "rgba(255,228,210,0.1)",
  },
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
