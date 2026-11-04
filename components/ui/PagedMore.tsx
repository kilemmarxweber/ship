import { Pressable, StyleSheet, Text } from "react-native";

import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

export function PagedMore({
  hasMore,
  remaining,
  onMore,
}: {
  hasMore: boolean;
  remaining?: number;
  onMore: () => void;
}) {
  const c = useColors();
  if (!hasMore) return null;
  return (
    <Pressable
      onPress={onMore}
      style={[styles.btn, { borderColor: HAIRLINE, backgroundColor: c.card }]}
    >
      <Text style={[styles.label, { color: c.primary }]}>
        Voir plus
        {remaining != null && remaining > 0 ? ` (${remaining})` : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  label: { fontWeight: "800", fontSize: 14 },
});
