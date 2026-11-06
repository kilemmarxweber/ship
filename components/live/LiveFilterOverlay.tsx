import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import {
  arFilterById,
  colorLookFromArId,
  type ArFilter,
} from "@/src/live-ar-filters";
import { isLiveLookId, type LiveLookId } from "@/src/live-look";

function ColorGrade({
  look,
  soft,
}: {
  look: LiveLookId;
  soft: number;
}) {
  if (look === "naturel") return null;

  if (look === "studio") {
    return (
      <>
        <View
          style={[
            styles.fill,
            { backgroundColor: `rgba(255,244,232,${0.16 * soft})` },
          ]}
        />
        <View
          style={[
            styles.fill,
            { backgroundColor: `rgba(255,250,245,${0.14 * soft})` },
          ]}
        />
        <LinearGradient
          colors={[
            `rgba(255,236,214,${0.22 * soft})`,
            `rgba(255,248,240,${0.12 * soft})`,
            `rgba(255,236,214,${0.18 * soft})`,
          ]}
          style={styles.fill}
        />
        <View
          style={[
            styles.fill,
            { backgroundColor: `rgba(255,214,196,${0.08 * soft})` },
          ]}
        />
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
      </>
    );
  }

  if (look === "doux") {
    return (
      <>
        <View
          style={[
            styles.fill,
            { backgroundColor: `rgba(255,248,242,${0.22 * soft})` },
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
      </>
    );
  }

  if (look === "vivid") {
    return (
      <LinearGradient
        colors={[
          `rgba(255,92,40,${0.12 * soft})`,
          `rgba(255,255,255,${0.04 * soft})`,
          `rgba(40,90,255,${0.12 * soft})`,
        ]}
        style={styles.fill}
      />
    );
  }

  if (look === "cinema") {
    return (
      <LinearGradient
        colors={[
          `rgba(255,140,64,${0.14 * soft})`,
          `rgba(20,30,36,${0.08 * soft})`,
          `rgba(12,70,78,${0.2 * soft})`,
        ]}
        style={styles.fill}
      />
    );
  }

  if (look === "noir") {
    return (
      <View
        style={[
          styles.fill,
          { backgroundColor: `rgba(10,10,14,${0.34 * soft})` },
        ]}
      />
    );
  }

  return null;
}

function BlushBeauty({ soft }: { soft: number }) {
  return (
    <>
      <View
        style={[
          styles.blush,
          styles.blushLeft,
          { backgroundColor: `rgba(255,120,140,${0.22 * soft})` },
        ]}
      />
      <View
        style={[
          styles.blush,
          styles.blushRight,
          { backgroundColor: `rgba(255,120,140,${0.22 * soft})` },
        ]}
      />
      <View
        style={[
          styles.fill,
          { backgroundColor: `rgba(255,236,228,${0.1 * soft})` },
        ]}
      />
    </>
  );
}

function StickerLayer({ filter, soft }: { filter: ArFilter; soft: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (filter.type !== "animation") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [filter.id, filter.type, pulse]);

  const anchorStyle =
    filter.anchor === "head"
      ? styles.anchorHead
      : filter.anchor === "eyes"
        ? styles.anchorEyes
        : styles.anchorFace;

  const size = Math.round(42 * filter.scale * (soft < 1 ? 0.75 : 1));

  if (filter.type === "animation" && filter.id === "sparkle") {
    return (
      <View style={styles.fill} pointerEvents="none">
        {["12%", "28%", "70%", "78%", "50%"].map((left, index) => (
          <Animated.Text
            key={left}
            style={[
              styles.sparkle,
              {
                left: left as `${number}%`,
                top: `${18 + index * 12}%`,
                fontSize: 18 + (index % 3) * 4,
                opacity: soft,
                transform: [{ scale: pulse }],
              },
            ]}
          >
            ✦
          </Animated.Text>
        ))}
      </View>
    );
  }

  if (filter.type === "animation" && (filter.id === "heart" || filter.id === "star")) {
    return (
      <View style={styles.fill} pointerEvents="none">
        <Animated.Text
          style={[
            styles.sticker,
            styles.anchorEyes,
            { left: "18%", fontSize: size, opacity: soft, transform: [{ scale: pulse }] },
          ]}
        >
          {filter.emoji}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.sticker,
            styles.anchorEyes,
            { left: "68%", fontSize: size, opacity: soft, transform: [{ scale: pulse }] },
          ]}
        >
          {filter.emoji}
        </Animated.Text>
      </View>
    );
  }

  if (filter.type !== "overlay" && filter.type !== "animation") return null;

  return (
    <Animated.Text
      style={[
        styles.sticker,
        anchorStyle,
        {
          fontSize: size,
          opacity: soft,
          transform: [{ scale: pulse }],
        },
      ]}
    >
      {filter.emoji}
    </Animated.Text>
  );
}

/**
 * Filtres Live : grades couleur + stickers AR + beauté légère.
 * « none » / naturel sans overlay = désactivation réelle du rendu.
 */
export function LiveFilterOverlay({
  look,
  intensity = "full",
}: {
  look: LiveLookId | string;
  intensity?: "full" | "pip";
}) {
  if (look === "none" || look === "naturel") return null;

  const soft = intensity === "pip" ? 0.58 : 1;
  const filter = arFilterById(look);
  const colorId =
    (filter ? colorLookFromArId(filter.id) : null) ??
    (isLiveLookId(look) ? look : null);

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      {colorId && isLiveLookId(colorId) ? (
        <ColorGrade look={colorId} soft={soft} />
      ) : null}
      {filter?.id === "blush" ? <BlushBeauty soft={soft} /> : null}
      {filter &&
      (filter.type === "overlay" || filter.type === "animation") &&
      filter.id !== "none" ? (
        <StickerLayer filter={filter} soft={soft} />
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
  sticker: {
    position: "absolute",
    alignSelf: "center",
    textAlign: "center",
  },
  anchorHead: {
    top: "8%",
    left: 0,
    right: 0,
  },
  anchorEyes: {
    top: "34%",
    left: 0,
    right: 0,
  },
  anchorFace: {
    top: "42%",
    left: 0,
    right: 0,
  },
  blush: {
    position: "absolute",
    width: 56,
    height: 28,
    borderRadius: 20,
    top: "46%",
  },
  blushLeft: { left: "18%" },
  blushRight: { right: "18%" },
  sparkle: {
    position: "absolute",
    color: "#FFE8A3",
  },
});
