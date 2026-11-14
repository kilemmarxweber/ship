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
import { colors } from "@/src/theme";

const LOGO_ORANGE = colors.primary;
const FAB_SIZE = 56;
const GAP = 9;
const HOLE_R = FAB_SIZE / 2 + GAP;
const DISK_R = 280;
const CY = 16;
const BAR_BODY = 64;

function PublishFab() {
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
    <Animated.View style={[styles.fab, fabStyle]}>
      <Animated.View style={[styles.fabLayer, foxStyle]}>
        <Image
          source={require("@/assets/images/fox-emoji.jpg")}
          style={styles.fabFox}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View style={[styles.fabLayer, plusStyle]} pointerEvents="none">
        <Ionicons name="add" size={30} color="#fff" />
      </Animated.View>
    </Animated.View>
  );
}

function TabBarShape() {
  const [barW, setBarW] = useState(0);
  return (
    <View
      pointerEvents="none"
      style={styles.bar}
      onLayout={(event) => setBarW(event.nativeEvent.layout.width)}
    >
      {barW > 0 ? (
        <View
          style={[
            styles.cut,
            {
              left: barW / 2 - DISK_R,
              top: CY - DISK_R,
            },
          ]}
        />
      ) : (
        <View style={styles.barFill} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const cartCount = useCart((state) => state.count);
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const inbox = useInbox();
  const messageBadge = inbox.data?.badge ?? 0;
  const barHeight = BAR_BODY + insets.bottom;

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
          fontSize: 11,
          fontWeight: "700",
          includeFontPadding: false,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 10,
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
              size={24}
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
              size={24}
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
          tabBarIcon: () => <PublishFab />,
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
              {props.children}
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
            fontSize: 10,
            fontWeight: "800",
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubble" : "chatbubble-outline"}
              size={24}
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
            fontSize: 10,
            fontWeight: "800",
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cart" : "cart-outline"}
              size={24}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  barFill: { flex: 1, backgroundColor: colors.tabBar },
  cut: {
    position: "absolute",
    width: DISK_R * 2,
    height: DISK_R * 2,
    borderRadius: DISK_R,
    borderWidth: DISK_R - HOLE_R,
    borderColor: colors.tabBar,
    backgroundColor: "transparent",
  },
  fabHit: {
    overflow: "visible",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    marginTop: CY - FAB_SIZE / 2,
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
  fabFox: {
    width: FAB_SIZE - 4,
    height: FAB_SIZE - 4,
    borderRadius: (FAB_SIZE - 4) / 2,
  },
});
