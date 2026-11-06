import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import type { LiveLookId } from "@/src/live-look";

/**
 * Filtres studio plein cadre (vidéo entière).
 * - Lisse / adoucit la peau (taches) via lift + diffusion globale
 * - Touche aussi le décor / objets derrière (pas un halo visage seul)
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
  const soft = pip ? 0.58 : 1;

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      {look === "studio" ? (
        <>
          {/* Base crème plein écran — unifie teint + décor */}
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,244,232,${0.16 * soft})` },
            ]}
          />
          {/* Diffusion « soft focus » : réduit le contraste des taches partout */}
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,250,245,${0.14 * soft})` },
            ]}
          />
          {/* Lift chaud uniforme (peau + fond) */}
          <LinearGradient
            colors={[
              `rgba(255,236,214,${0.22 * soft})`,
              `rgba(255,248,240,${0.12 * soft})`,
              `rgba(255,236,214,${0.18 * soft})`,
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.fill}
          />
          {/* Atténue les rougeurs / taches (voile pêche global) */}
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,214,196,${0.08 * soft})` },
            ]}
          />
          {/* Clarté décor : léger voile pour coller peau + arrière-plan */}
          <LinearGradient
            colors={[
              `rgba(255,255,255,${0.06 * soft})`,
              "transparent",
              `rgba(255,248,240,${0.1 * soft})`,
            ]}
            style={styles.fill}
          />
          {/* Vignette douce bords — plein cadre, pas de trou central */}
          <LinearGradient
            colors={[
              `rgba(18,12,8,${0.22 * soft})`,
              "transparent",
              "transparent",
              `rgba(18,12,8,${0.26 * soft})`,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
          <LinearGradient
            colors={[
              `rgba(18,12,8,${0.18 * soft})`,
              "transparent",
              "transparent",
              `rgba(12,10,8,${0.28 * soft})`,
            ]}
            style={styles.fill}
          />
        </>
      ) : null}

      {look === "doux" ? (
        <>
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,248,242,${0.22 * soft})` },
            ]}
          />
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,236,228,${0.12 * soft})` },
            ]}
          />
          <LinearGradient
            colors={[
              `rgba(255,220,210,${0.16 * soft})`,
              `rgba(255,248,242,${0.1 * soft})`,
              `rgba(255,230,218,${0.14 * soft})`,
            ]}
            style={styles.fill}
          />
          <LinearGradient
            colors={[
              `rgba(40,28,24,${0.16 * soft})`,
              "transparent",
              "transparent",
              `rgba(40,28,24,${0.2 * soft})`,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
        </>
      ) : null}

      {look === "vivid" ? (
        <>
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,255,255,${0.04 * soft})` },
            ]}
          />
          <LinearGradient
            colors={[
              `rgba(255,92,40,${0.12 * soft})`,
              `rgba(255,255,255,${0.04 * soft})`,
              `rgba(40,90,255,${0.12 * soft})`,
            ]}
            style={styles.fill}
          />
          <LinearGradient
            colors={[
              `rgba(0,0,0,${0.12 * soft})`,
              "transparent",
              `rgba(0,0,0,${0.16 * soft})`,
            ]}
            style={styles.fill}
          />
        </>
      ) : null}

      {look === "cinema" ? (
        <>
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(255,180,120,${0.06 * soft})` },
            ]}
          />
          <LinearGradient
            colors={[
              `rgba(255,140,64,${0.14 * soft})`,
              `rgba(20,30,36,${0.08 * soft})`,
              `rgba(12,70,78,${0.2 * soft})`,
            ]}
            style={styles.fill}
          />
          <LinearGradient
            colors={[
              `rgba(0,0,0,${0.28 * soft})`,
              "transparent",
              "transparent",
              `rgba(0,0,0,${0.32 * soft})`,
            ]}
            style={styles.fill}
          />
        </>
      ) : null}

      {look === "noir" ? (
        <>
          <View
            style={[
              styles.fill,
              { backgroundColor: `rgba(10,10,14,${0.34 * soft})` },
            ]}
          />
          <LinearGradient
            colors={[
              `rgba(0,0,0,${0.2 * soft})`,
              "transparent",
              `rgba(0,0,0,${0.28 * soft})`,
            ]}
            style={styles.fill}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
});
