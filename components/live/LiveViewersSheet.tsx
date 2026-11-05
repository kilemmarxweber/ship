import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetReduce } from "@/components/ui/SheetReduce";
import { compactCount } from "@/src/format";
import { mediaUrl } from "@/src/api";
import type { LiveViewer } from "@/src/live";
import { colors } from "@/src/theme";

function formatWatch(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m} min ${String(r).padStart(2, "0")}s`;
}

export function LiveViewersSheet({
  open,
  onClose,
  viewerCount,
  qualifiedCount,
  viewers,
}: {
  open: boolean;
  onClose: () => void;
  viewerCount: number;
  qualifiedCount: number;
  viewers: LiveViewer[];
}) {
  const insets = useSafeAreaInsets();
  const online = viewers.filter((row) => row.online);
  const past = viewers.filter((row) => !row.online && row.qualified);

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.frame}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <SheetReduce onPress={onClose} />
          <View style={styles.head}>
            <View style={styles.badge}>
              <Ionicons name="eye" size={18} color="#7dffb3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Spectateurs</Text>
              <Text style={styles.sub}>
                {compactCount(viewerCount)} en direct
                {qualifiedCount > 0
                  ? ` · ${compactCount(qualifiedCount)} ≥ 1 min`
                  : ""}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {online.length === 0 && past.length === 0 ? (
              <Text style={styles.empty}>
                Personne n’est encore connecté sur ce live.
              </Text>
            ) : null}

            {online.length > 0 ? (
              <Text style={styles.section}>En direct</Text>
            ) : null}
            {online.map((row) => (
              <ViewerRow key={row.peerKey} row={row} />
            ))}

            {past.length > 0 ? (
              <Text style={[styles.section, { marginTop: 14 }]}>
                Ont suivi ≥ 1 min
              </Text>
            ) : null}
            {past.map((row) => (
              <ViewerRow key={row.peerKey} row={row} dimmed />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ViewerRow({
  row,
  dimmed,
}: {
  row: LiveViewer;
  dimmed?: boolean;
}) {
  const uri = mediaUrl(row.image) ?? row.image ?? null;
  return (
    <View style={[styles.row, dimmed && styles.rowDim]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.letter}>
            {(row.name || "?").slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.online ? "En ligne" : "Parti"}
          {" · "}
          {formatWatch(row.watchedSeconds)}
          {row.qualified ? " · ≥1 min" : ""}
        </Text>
      </View>
      {row.online ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#12121A",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: "78%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,214,143,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  list: { maxHeight: 420 },
  listContent: { gap: 8, paddingBottom: 8 },
  section: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  empty: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    paddingVertical: 28,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowDim: { opacity: 0.72 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#222" },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { color: "#fff", fontWeight: "800", fontSize: 15 },
  name: { color: "#fff", fontWeight: "800", fontSize: 14 },
  meta: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00D68F",
  },
});
