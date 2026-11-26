import { Image } from "expo-image";
import { useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPLASH_BG = "#0A0A0F";

export function LaunchSplash({ onPaint }: { onPaint: () => void }) {
  const painted = useRef(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const logo = Math.min(300, Math.round(width * 0.62));

  return (
    <View
      style={styles.root}
      onLayout={() => {
        if (painted.current) return;
        painted.current = true;
        onPaint();
      }}
    >
      <Image
        source={require("@/assets/images/splash-icon.png")}
        style={{ width: logo, height: logo }}
        contentFit="contain"
        accessibilityLabel="ShipShop"
      />
      <View
        style={[styles.brand, { bottom: Math.max(28, insets.bottom + 24) }]}
        accessibilityLabel="from Klambocore"
      >
        <Text style={styles.credit} numberOfLines={1} adjustsFontSizeToFit>
          from Klambocore
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  credit: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
    textAlign: "center",
    includeFontPadding: false,
  },
});
