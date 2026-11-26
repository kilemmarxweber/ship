import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/src/cart-store";
import { compactCount } from "@/src/format";
import { useInbox } from "@/src/inbox";
import { useSession } from "@/src/session";
import { useTabBarMetrics } from "@/src/tab-bar-metrics";
import { colors } from "@/src/theme";

const LOGO_ORANGE = colors.primary;

function PublishFab() {
  const { fab, cy, plus } = useTabBarMetrics();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withDelay(
          1400,
          withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) }),
        ),
        withDelay(
          900,
          withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) }),
        ),
      ),
      -1,
      false,
    );
  }, [progress]);

  const fabStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["#FFFFFF", LOGO_ORANGE],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [LOGO_ORANGE, "#FFFFFF"],
    ),
  }));

  const foxStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55, 1], [1, 0.2, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 0.35]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` },
    ],
  }));

  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.45, 1], [0, 0.35, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.35, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-80, 0])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.fab,
        fabStyle,
        {
          width: fab,
          height: fab,
          borderRadius: fab / 2,
          marginTop: cy - fab / 2,
        },
      ]}
    >
      <Animated.View style={[styles.fabLayer, foxStyle]}>
        <Image
          source={require("@/assets/images/fox-emoji.jpg")}
          style={{
            width: fab - 4,
            height: fab - 4,
            borderRadius: (fab - 4) / 2,
          }}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View style={[styles.fabLayer, plusStyle]} pointerEvents="none">
        <Ionicons name="add" size={plus} color="#fff" />
      </Animated.View>
    </Animated.View>
  );
}

function TabBarShape() {
  const { holeR, cy, radius } = useTabBarMetrics();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const diskR =
    box.w > 0
      ? Math.ceil(Math.hypot(box.w / 2, Math.max(0, box.h - cy)) + 8)
      : 0;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.bar,
        { borderTopLeftRadius: radius, borderTopRightRadius: radius },
      ]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((current) =>
          current.w === width && current.h === height
            ? current
            : { w: width, h: height },
        );
      }}
    >
      {diskR > holeR ? (
        <View
          style={{
            position: "absolute",
            left: box.w / 2 - diskR,
            top: cy - diskR,
            width: diskR * 2,
            height: diskR * 2,
            borderRadius: diskR,
            borderWidth: diskR - holeR,
            borderColor: colors.tabBar,
            backgroundColor: "transparent",
          }}
        />
      ) : (
        <View style={styles.barFill} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const metrics = useTabBarMetrics();
  const cartCount = useCart((state) => state.count);
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const inbox = useInbox();
  const messageBadge = inbox.data?.unreadMessages ?? 0;
  const barHeight = metrics.barBody + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "rgba(255,255,255,0.48)",
        tabBarShowLabel: true,
        tabBarBackground: () => <TabBarShape />,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: barHeight,
          paddingTop: 0,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          overflow: "visible",
        },
        tabBarLabelStyle: {
          fontSize: metrics.label,
          fontWeight: "700",
          includeFontPadding: false,
          marginTop: Math.round(2 * metrics.scale),
        },
        tabBarItemStyle: {
          paddingTop: metrics.padTop,
          justifyContent: "flex-start",
          overflow: "visible",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={metrics.icon}
              color={typeof color === "string" ? color : "#9AA0A6"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="boutique"
        options={{
          title: "Découvrir",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "compass" : "compass-outline"}
              size={metrics.icon}
              color={typeof color === "string" ? color : "#9AA0A6"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: "Publier",
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            justifyContent: "flex-start",
            overflow: "visible",
          },
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publier"
              onPress={(event) => {
                if (!token) {
                  openAuth();
                  return;
                }
                props.onPress?.(event);
              }}
              style={[props.style, styles.fabHit]}
            >
              <PublishFab />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge:
            messageBadge > 0 ? compactCount(messageBadge) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.buyStart,
            color: "#fff",
            fontSize: metrics.badge,
            fontWeight: "800",
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubble" : "chatbubble-outline"}
              size={metrics.icon}
              color={typeof color === "string" ? color : "#9AA0A6"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarBadge: cartCount > 0 ? compactCount(cartCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.buyStart,
            color: "#fff",
            fontSize: metrics.badge,
            fontWeight: "800",
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cart" : "cart-outline"}
              size={metrics.icon}
              color={typeof color === "string" ? color : "#9AA0A6"}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    overflow: "hidden",
  },
  barFill: { flex: 1, backgroundColor: colors.tabBar },
  fabHit: {
    width: "100%",
    overflow: "visible",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  fab: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: LOGO_ORANGE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: LOGO_ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
