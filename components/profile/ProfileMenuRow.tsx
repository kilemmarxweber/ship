import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

type ProfileMenuRowProps = {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ProfileMenuRow({
  icon,
  label,
  hint,
  onPress,
  style,
}: ProfileMenuRowProps) {
  const c = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      android_ripple={{ color: `${c.primary}33` }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? `${c.primary}14` : c.card,
          borderColor: pressed ? `${c.primary}55` : HAIRLINE,
        },
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${c.primary}18` }]}>
        <Ionicons name={icon} size={18} color={c.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: c.text }]} numberOfLines={2}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: c.textMuted }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 2 },
  label: { fontWeight: "700", fontSize: 15 },
  hint: { fontSize: 12, lineHeight: 16 },
});
