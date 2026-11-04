import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

export function ChoiceCard({
  icon,
  tint,
  title,
  subtitle,
  delay = 0,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  title: string;
  subtitle: string;
  delay?: number;
  onPress: () => void;
}) {
  const c = useColors();
  const accent = tint ?? c.primary;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(240)}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: HAIRLINE,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
          <Ionicons name={icon} size={24} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>{subtitle}</Text>
        </View>
        <View style={[styles.chevron, { backgroundColor: `${accent}18` }]}>
          <Ionicons name="arrow-forward" size={16} color={accent} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    minHeight: 76,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", fontSize: 18 },
  sub: {
    marginTop: 4,
    lineHeight: 18,
    fontSize: 13,
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
