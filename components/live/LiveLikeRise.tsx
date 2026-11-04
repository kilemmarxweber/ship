import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { formatMoney } from "@/src/format";

export type LiveFx = {
  id: string;
  kind: "like" | "gift";
  amountCents?: number;
};

const FLOWERS = ["🌸", "🌺", "🌼", "💮", "🌹", "🌷"];
const BILLS = ["💵", "💸"];

export function LiveLikeRise({ events }: { events: LiveFx[] }) {
  if (!events.length) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      {events.map((event) =>
        event.kind === "like" ? (
          <LikeFx key={event.id} id={event.id} />
        ) : (
          <GiftFx
            key={event.id}
            id={event.id}
            amountCents={event.amountCents ?? 0}
          />
        ),
      )}
    </View>
  );
}

function LikeFx({ id }: { id: string }) {
  const bits = useMemo(() => hashBits(id, 40), [id]);
  return (
    <>
      <Flash color="rgba(255,80,160,0.6)" />
      <Rays tint="#FFD6EE" />
      {Array.from({ length: 22 }, (_, i) => {
        const ang = (i / 22) * Math.PI * 2 + bits[i] * 0.45;
        const dist = 90 + bits[i + 18] * 130;
        return (
          <Fly
            key={`h-${i}`}
            dx={Math.cos(ang) * dist}
            dy={Math.sin(ang) * dist}
            delay={bits[i] * 90}
            duration={900 + bits[i] * 400}
          >
            <Ionicons name="heart" size={16 + bits[i] * 16} color="#FF4D8D" />
          </Fly>
        );
      })}
      {Array.from({ length: 16 }, (_, i) => {
        const ang = (i / 16) * Math.PI * 2;
        const dist = 50 + bits[i] * 140;
        return (
          <Fly
            key={`s-${i}`}
            dx={Math.cos(ang) * dist}
            dy={Math.sin(ang) * dist}
            delay={40 + bits[i] * 80}
            duration={800}
          >
            <Text style={styles.spark}>✦</Text>
          </Fly>
        );
      })}
    </>
  );
}

function GiftFx({ id, amountCents }: { id: string; amountCents: number }) {
  const bits = useMemo(() => hashBits(id, 32), [id]);
  return (
    <>
      <Flash color="rgba(125,255,179,0.58)" />
      <Rays tint="#C8FFE0" />
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2 + bits[i] * 0.4;
        const dist = 80 + bits[i + 14] * 140;
        return (
          <Fly
            key={`f-${i}`}
            dx={Math.cos(ang) * dist}
            dy={Math.sin(ang) * dist - 16}
            delay={bits[i] * 100}
            duration={1100 + bits[i] * 400}
          >
            <Text style={styles.emoji}>{FLOWERS[i % FLOWERS.length]}</Text>
          </Fly>
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + 0.2;
        const dist = 60 + bits[i] * 150;
        return (
          <Fly
            key={`b-${i}`}
            dx={Math.cos(ang) * dist}
            dy={Math.sin(ang) * dist}
            delay={50 + bits[i] * 90}
            duration={1000}
          >
            <Text style={styles.emoji}>{BILLS[i % BILLS.length]}</Text>
          </Fly>
        );
      })}
      {amountCents > 0 ? <PopLabel text={formatMoney(amountCents)} /> : null}
    </>
  );
}

function Rays({ tint }: { tint: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.2 ? p.value / 0.2 : (1 - p.value) * 1.1,
    transform: [
      { rotate: `${p.value * 70}deg` },
      { scale: 0.45 + p.value * 1.15 },
    ],
  }));
  return (
    <Animated.View style={[styles.rays, style]}>
      {Array.from({ length: 12 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.ray,
            {
              backgroundColor: tint,
              transform: [{ rotate: `${i * 30}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function Flash({ color }: { color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.25 ? p.value / 0.25 : (1 - p.value) / 0.75,
    transform: [{ scale: 0.4 + p.value * 2.1 }],
  }));
  return (
    <Animated.View style={[styles.flash, { backgroundColor: color }, style]} />
  );
}

function PopLabel({ text }: { text: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, {
      duration: 1350,
      easing: Easing.out(Easing.cubic),
    });
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity:
      p.value < 0.18 ? p.value / 0.18 : p.value > 0.7 ? (1 - p.value) / 0.3 : 1,
    transform: [
      {
        scale:
          p.value < 0.18
            ? 0.4 + (p.value / 0.18) * 0.78
            : 1.18 - p.value * 0.18,
      },
    ],
  }));
  return (
    <Animated.View style={[styles.amountWrap, style]}>
      <Text style={styles.amount}>{text}</Text>
    </Animated.View>
  );
}

function Fly({
  dx,
  dy,
  delay,
  duration,
  children,
}: {
  dx: number;
  dy: number;
  delay: number;
  duration: number;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      p.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(t);
  }, [delay, duration, p]);
  const style = useAnimatedStyle(() => ({
    opacity:
      p.value < 0.12
        ? p.value / 0.12
        : p.value > 0.72
          ? (1 - p.value) / 0.28
          : 1,
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value },
      { scale: p.value < 0.14 ? 0.2 + p.value * 6 : 1.15 - p.value * 0.5 },
    ],
  }));
  return <Animated.View style={[styles.bit, style]}>{children}</Animated.View>;
}

function hashBits(id: string, n: number) {
  const out: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    out.push((h >>> 0) / 2 ** 32);
  }
  return out;
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 45,
    elevation: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  flash: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  rays: {
    position: "absolute",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  ray: {
    position: "absolute",
    width: 8,
    height: 110,
    borderRadius: 4,
    opacity: 0.55,
  },
  bit: {
    position: "absolute",
  },
  spark: {
    color: "#FFE08A",
    fontSize: 14,
    textShadowColor: "rgba(255,220,120,0.9)",
    textShadowRadius: 8,
  },
  emoji: { fontSize: 26 },
  amountWrap: { position: "absolute" },
  amount: {
    color: "#7dffb3",
    fontSize: 28,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});
