import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatMoney } from "@/src/format";

const GIFTS = [
  { cents: 50, emoji: "🌸", label: "Fleur" },
  { cents: 100, emoji: "✨", label: "Éclat" },
  { cents: 200, emoji: "💐", label: "Bouquet" },
  { cents: 500, emoji: "💎", label: "Joyau" },
  { cents: 1_000, emoji: "👑", label: "Couronne" },
  { cents: 2_500, emoji: "🚀", label: "Boost" },
  { cents: 10_000, emoji: "🏆", label: "Star" },
] as const;

export function LiveGiftSheet({
  open,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (amountCents: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("1.50");

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
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <View style={styles.badge}>
                <Ionicons name="gift" size={18} color="#7dffb3" />
              </View>
              <View>
                <Text style={styles.title}>Envoyer un cadeau</Text>
                <Text style={styles.sub}>
                  Fleurs et lumière au centre du live
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {GIFTS.map((gift) => (
              <Pressable
                key={gift.cents}
                disabled={busy}
                style={styles.card}
                onPress={() => onSend(gift.cents)}
              >
                <Text style={styles.emoji}>{gift.emoji}</Text>
                <Text style={styles.label}>{gift.label}</Text>
                <Text style={styles.price}>{formatMoney(gift.cents)}</Text>
              </Pressable>
            ))}
            <Pressable
              disabled={busy}
              style={[styles.card, customOpen && styles.cardOn]}
              onPress={() => setCustomOpen((value) => !value)}
            >
              <Text style={styles.emoji}>🎁</Text>
              <Text style={styles.label}>Plus</Text>
              <Text style={styles.more}>Libre</Text>
            </Pressable>
          </View>
          {customOpen ? (
            <View style={styles.customRow}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                keyboardType="decimal-pad"
                placeholder="Montant ($)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
              />
              <Pressable
                disabled={busy}
                style={styles.send}
                onPress={() => {
                  const dollars = Number.parseFloat(custom.replace(",", "."));
                  if (!Number.isFinite(dollars) || dollars <= 0) return;
                  onSend(Math.round(dollars * 100));
                }}
              >
                <Text style={styles.sendText}>Envoyer</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.hint}>
            Aucun plafond — débité sur votre portefeuille. Le montant reste
            privé pour le diffuseur.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    overflow: "hidden",
    backgroundColor: "#121218",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundColor: "rgba(125,255,179,0.12)",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(125,255,179,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    width: "23%",
    flexGrow: 1,
    minHeight: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  cardOn: {
    borderColor: "rgba(125,255,179,0.5)",
    backgroundColor: "rgba(125,255,179,0.14)",
  },
  emoji: { fontSize: 28 },
  label: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 11 },
  price: { color: "#7dffb3", fontWeight: "800", fontSize: 13 },
  more: { color: "#fff", fontWeight: "800", fontSize: 13 },
  customRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    paddingHorizontal: 12,
    fontSize: 16,
  },
  send: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#7dffb3",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#05140F", fontWeight: "800" },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 15 },
});
