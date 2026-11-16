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
      <Text style={[styles.name, { bottom: insets.bottom + 36 }]}>
        Klambocore
      </Text>
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
  name: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
});
