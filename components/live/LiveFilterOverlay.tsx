import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
    Animated,
    StyleSheet,
    View,
    type LayoutChangeEvent,
} from "react-native";

import {
    arFilterById,
    colorLookFromArId,
    filterNeedsFacePose,
    type ArFilter,
} from "@/src/live-ar-filters";
import {
    anchorStyleFor,
    defaultFacePose,
    propFontSizeFor,
    type FaceAnchorId,
    type FacePose,
} from "@/src/live-face-tracking";
import { isLiveLookId, type LiveLookId } from "@/src/live-look";
import { useFacePose } from "@/src/use-live-face-pose";

function ColorGrade({ look, soft }: { look: LiveLookId; soft: number }) {
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

function BlushBeauty({ pose, soft }: { pose: FacePose; soft: number }) {
  const conf = pose.confidence * soft;
  if (conf < 0.2) return null;
  const w = Math.max(36, pose.width * 220);
  const h = Math.max(18, pose.height * 90);
  const rot = `${(pose.roll * 180) / Math.PI}deg`;
  return (
    <>
      <View
        style={[
          styles.blush,
          {
            left: `${pose.leftCheek.x * 100}%`,
            top: `${pose.leftCheek.y * 100}%`,
            width: w,
            height: h,
            opacity: conf * 0.9,
            transform: [
              { translateX: -w / 2 },
              { translateY: -h / 2 },
              { rotate: rot },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.blush,
          {
            left: `${pose.rightCheek.x * 100}%`,
            top: `${pose.rightCheek.y * 100}%`,
            width: w,
            height: h,
            opacity: conf * 0.9,
            transform: [
              { translateX: -w / 2 },
              { translateY: -h / 2 },
              { rotate: rot },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.fill,
          {
            backgroundColor: `rgba(255,236,228,${0.1 * soft * pose.confidence})`,
          },
        ]}
      />
    </>
  );
}

function StickerAt({
  emoji,
  pose,
  anchor,
  soft,
  pulse,
  fontSize,
}: {
  emoji: string;
  pose: FacePose;
  anchor: FaceAnchorId;
  soft: number;
  pulse: Animated.Value;
  fontSize: number;
}) {
  const style = anchorStyleFor(pose, anchor, 1, soft, fontSize);
  if (!style.visible && style.opacity <= 0.02) return null;
  return (
    <Animated.View
      style={[
        styles.stickerWrap,
        {
          left: style.left,
          top: style.top,
          opacity: style.opacity,
          transform: [...style.transform, { scale: pulse }],
        },
      ]}
    >
      <Animated.Text style={[styles.sticker, { fontSize }]}>
        {emoji}
      </Animated.Text>
    </Animated.View>
  );
}

function StickerLayer({
  filter,
  pose,
  soft,
}: {
  filter: ArFilter;
  pose: FacePose;
  soft: number;
}) {
  const [pulse] = useState(() => new Animated.Value(1));
  const [layoutW, setLayoutW] = useState(360);

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

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 40 && Math.abs(w - layoutW) > 2) setLayoutW(w);
  };

  const softScale = soft < 1 ? 0.82 : 1;
  const sizeFor = (anchor: FaceAnchorId) =>
    propFontSizeFor(pose, anchor, layoutW, filter.scale * softScale);

  if (filter.type === "animation" && filter.id === "sparkle") {
    const conf = pose.confidence * soft;
    const spark = Math.round(sizeFor("head") * 0.28);
    return (
      <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
        {[
          { x: pose.headTop.x - 0.12, y: pose.headTop.y + 0.04 },
          { x: pose.headTop.x + 0.1, y: pose.headTop.y + 0.02 },
          { x: pose.leftEye.x - 0.08, y: pose.leftEye.y - 0.06 },
          { x: pose.rightEye.x + 0.08, y: pose.rightEye.y - 0.06 },
          { x: pose.nose.x, y: pose.nose.y + 0.12 },
        ].map((pt, index) => (
          <Animated.Text
            key={`${pt.x}-${index}`}
            style={[
              styles.sparkle,
              {
                left: `${pt.x * 100}%`,
                top: `${pt.y * 100}%`,
                fontSize: spark + (index % 3) * 4,
                opacity: conf,
                transform: [
                  { scale: pulse },
                  { translateX: -8 },
                  { translateY: -8 },
                ],
              },
            ]}
          >
            ✦
          </Animated.Text>
        ))}
      </View>
    );
  }

  if (
    filter.type === "animation" &&
    (filter.id === "heart" || filter.id === "star")
  ) {
    const earSize = sizeFor("earLeft");
    return (
      <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
        <StickerAt
          emoji={filter.emoji}
          pose={pose}
          anchor="earLeft"
          soft={soft}
          pulse={pulse}
          fontSize={earSize}
        />
        <StickerAt
          emoji={filter.emoji}
          pose={pose}
          anchor="earRight"
          soft={soft}
          pulse={pulse}
          fontSize={earSize}
        />
      </View>
    );
  }

  if (filter.anchor === "ears" || filter.id === "earrings") {
    const earSize = sizeFor("earLeft");
    return (
      <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
        <StickerAt
          emoji={filter.emoji}
          pose={pose}
          anchor="earLeft"
          soft={soft}
          pulse={pulse}
          fontSize={earSize}
        />
        <StickerAt
          emoji={filter.emoji}
          pose={pose}
          anchor="earRight"
          soft={soft}
          pulse={pulse}
          fontSize={earSize}
        />
      </View>
    );
  }

  if (filter.type !== "overlay" && filter.type !== "animation") return null;

  const anchor: FaceAnchorId =
    filter.anchor === "head"
      ? "head"
      : filter.anchor === "eyes"
        ? "eyes"
        : filter.anchor === "nose"
          ? "nose"
          : "face";

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      <StickerAt
        emoji={filter.emoji}
        pose={pose}
        anchor={anchor}
        soft={soft}
        pulse={pulse}
        fontSize={sizeFor(anchor)}
      />
    </View>
  );
}

/**
 * Filtres Live : grades couleur + stickers ancrés au visage + beauté légère.
 */
export function LiveFilterOverlay({
  look,
  intensity = "full",
  pose,
}: {
  look: LiveLookId | string;
  intensity?: "full" | "pip";
  pose?: FacePose | null;
}) {
  const needsPose = filterNeedsFacePose(look);
  const tracked = useFacePose(needsPose && !pose);
  if (look === "none" || look === "naturel") return null;

  const soft = intensity === "pip" ? 0.58 : 1;
  const face = pose ?? (needsPose ? tracked : defaultFacePose());
  const filter = arFilterById(look);
  const colorId =
    (filter ? colorLookFromArId(filter.id) : null) ??
    (isLiveLookId(look) ? look : null);

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      {colorId && isLiveLookId(colorId) ? (
        <ColorGrade look={colorId} soft={soft} />
      ) : null}
      {filter?.id === "blush" ? <BlushBeauty pose={face} soft={soft} /> : null}
      {filter &&
      (filter.type === "overlay" || filter.type === "animation") &&
      filter.id !== "none" ? (
        <StickerLayer filter={filter} pose={face} soft={soft} />
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
  stickerWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  sticker: {
    textAlign: "center",
    includeFontPadding: false,
  },
  blush: {
    position: "absolute",
    borderRadius: 40,
    backgroundColor: "rgba(255,110,130,0.32)",
  },
  sparkle: {
    position: "absolute",
    color: "#FFE8A3",
  },
});
