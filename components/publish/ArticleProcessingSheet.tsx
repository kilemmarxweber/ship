import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/src/use-colors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 88;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function ArticleProcessingSheet({
  visible,
  progress,
  onClose,
  title = "Traitement...",
  subtitle = "Reste sur cet écran pour terminer le traitement",
}: {
  visible: boolean;
  progress: number;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withTiming(pct / 100, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, sweep]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - sweep.value),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.frame}>
        <View style={styles.dim} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: "#1C1C1E",
              paddingBottom: Math.max(insets.bottom, 24) + 28,
            },
          ]}
        >
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          ) : null}

          <View style={styles.plate}>
            <Svg
              width={SIZE}
              height={SIZE}
              style={styles.ring}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke="#F2F2F7"
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${C} ${C}`}
                animatedProps={ringProps}
              />
            </Svg>
            <Text style={styles.pct}>{pct}%</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>{subtitle}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderCurve: "continuous",
    paddingTop: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  plate: {
    width: 120,
    height: 120,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  ring: {
    transform: [{ rotate: "-90deg" }],
  },
  pct: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  title: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  sub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
});
