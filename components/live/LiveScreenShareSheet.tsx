import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetReduce } from "@/components/ui/SheetReduce";

export type LiveScreenShareMode = "full" | "app";

export function LiveScreenShareSheet({
  open,
  sharing,
  mode,
  busy,
  onClose,
  onStart,
  onStop,
}: {
  open: boolean;
  sharing: boolean;
  mode: LiveScreenShareMode | null;
  busy?: boolean;
  onClose: () => void;
  onStart: (mode: LiveScreenShareMode) => void;
  onStop: () => void;
}) {
  const insets = useSafeAreaInsets();

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
          <View style={styles.glow} />
          <SheetReduce onPress={onClose} />
          <View style={styles.head}>
            <View style={styles.badge}>
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color="#7dffb3"
              />
            </View>
            <View style={styles.headText}>
              <Text style={styles.title}>Partage d’écran</Text>
              <Text style={styles.sub}>
                Le live continue — ta caméra reste en vignette
              </Text>
            </View>
          </View>

          <Pressable
            disabled={busy}
            style={[styles.row, sharing && mode === "full" && styles.rowOn]}
            onPress={() => onStart("full")}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name="tablet-landscape-outline"
                size={20}
                color="#fff"
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Tout l’écran</Text>
              <Text style={styles.rowSub}>
                Affiche tout le téléphone, même hors ShipShop
              </Text>
            </View>
            {sharing && mode === "full" ? (
              <Ionicons name="checkmark-circle" size={20} color="#00D68F" />
            ) : null}
          </Pressable>

          <Pressable
            disabled={busy}
            style={[styles.row, sharing && mode === "app" && styles.rowOn]}
            onPress={() => onStart("app")}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="apps-outline" size={20} color="#fff" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Écran actif</Text>
              <Text style={styles.rowSub}>
                Une seule app (Android 14+) — sans le reste du téléphone
              </Text>
            </View>
            {sharing && mode === "app" ? (
              <Ionicons name="checkmark-circle" size={20} color="#00D68F" />
            ) : null}
          </Pressable>

          {sharing ? (
            <Pressable disabled={busy} style={styles.stop} onPress={onStop}>
              <Ionicons name="stop-circle-outline" size={20} color="#FBBF24" />
              <Text style={styles.stopText}>Arrêter le partage</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
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
    gap: 10,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  glow: {
    position: "absolute",
    top: -40,
    left: "20%",
    right: "20%",
    height: 80,
    backgroundColor: "rgba(0,214,143,0.18)",
    borderRadius: 80,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
    marginTop: 8,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,214,143,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, gap: 2 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rowOn: {
    borderColor: "rgba(0,214,143,0.55)",
    backgroundColor: "rgba(0,214,143,0.12)",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  rowSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  stop: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
  stopText: { color: "#FBBF24", fontWeight: "800", fontSize: 14 },
});
