import { useEffect, useState } from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/src/theme";

/** Spinner that appears only after a short delay — avoids flash on fast loads. */
export function SoftSpinner({
  color = colors.emerald,
  delayMs = 140,
  style,
}: {
  color?: string;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  if (!show) return <View style={style} />;
  return (
    <View style={style}>
      <ActivityIndicator color={color} />
    </View>
  );
}
