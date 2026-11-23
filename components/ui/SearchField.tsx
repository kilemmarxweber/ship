import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type ViewStyle,
} from "react-native";

import { usePrefs } from "@/src/prefs";
import { useColors } from "@/src/use-colors";

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  clearable?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
} & Pick<
  TextInputProps,
  "onSubmitEditing" | "keyboardType" | "autoCapitalize" | "autoCorrect"
>;

/** Same soft fill + hover/focus feel as the comments composer (`#1C1C1E` / `#F2F2F7`). */
export function SearchField({
  value,
  onChangeText,
  placeholder = "Rechercher…",
  style,
  autoFocus,
  returnKeyType = "search",
  clearable = true,
  icon = "search",
  onSubmitEditing,
  keyboardType,
  autoCapitalize = "none",
  autoCorrect = false,
}: SearchFieldProps) {
  const c = useColors();
  const theme = usePrefs((state) => state.theme);
  const dark = theme === "dark";
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const active = focused || hovered;

  const fill = dark
    ? active
      ? "#2C2C2E"
      : "#1C1C1E"
    : active
      ? "#E5E5EA"
      : "#F2F2F7";
  const placeholderColor = dark ? "rgba(255,255,255,0.35)" : "#8E8E93";
  const iconColor = dark ? "rgba(255,255,255,0.45)" : "#8E8E93";

  return (
    <View
      style={[styles.wrap, { backgroundColor: fill }, style]}
      {...(Platform.OS === "web"
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          }
        : null)}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        clearButtonMode={clearable ? "while-editing" : "never"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            color: dark ? "#fff" : c.text,
            ...(Platform.OS === "web"
              ? ({ outlineStyle: "none", outlineWidth: 0 } as object)
              : null),
          },
        ]}
      />
      {clearable && value && Platform.OS !== "ios" ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Effacer"
        >
          <Ionicons name="close-circle" size={18} color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 40,
    borderRadius: 17,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    minHeight: 28,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none", outlineWidth: 0 } as object)
      : null),
  },
});
