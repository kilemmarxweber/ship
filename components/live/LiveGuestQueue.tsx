import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mediaUrl } from "@/src/api";
import type { LiveGuest } from "@/src/live";

export function LiveGuestQueue({
  pending,
  busy,
  onAccept,
  onRefuse,
}: {
  pending: LiveGuest[];
  busy?: boolean;
  onAccept: (guestId: string) => void;
  onRefuse: (guestId: string) => void;
}) {
  if (!pending.length) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {pending.map((row) => {
        const face = mediaUrl(row.user.image);
        return (
          <View key={row.id} style={styles.card}>
            {face ? (
              <Image source={{ uri: face }} style={styles.face} />
            ) : (
              <View style={styles.face} />
            )}
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {row.user.name}
              </Text>
              <Text style={styles.hint}>Veut monter au live</Text>
            </View>
            <Pressable
              disabled={busy}
              style={styles.accept}
              onPress={() => onAccept(row.id)}
            >
              <Text style={styles.acceptText}>Oui</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={styles.refuse}
              onPress={() => onRefuse(row.id)}
            >
              <Text style={styles.refuseText}>Non</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, maxWidth: 280 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(8,8,12,0.82)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontWeight: "800", fontSize: 13 },
  hint: { color: "rgba(253,230,138,0.95)", fontSize: 11, fontWeight: "700" },
  accept: {
    backgroundColor: "#00D68F",
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 30,
    justifyContent: "center",
  },
  acceptText: { color: "#05140F", fontWeight: "800", fontSize: 12 },
  refuse: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 30,
    justifyContent: "center",
  },
  refuseText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
