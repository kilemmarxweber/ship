import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Popup React Native (Modal) — remplace les confirms JS / Alert web. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  destructive = true,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const c = useColors();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: c.textMuted }]}>
              {message}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Pressable
              disabled={busy}
              onPress={onCancel}
              style={[
                styles.btn,
                {
                  backgroundColor: c.background,
                  borderColor: HAIRLINE,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: c.text }]}>
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onConfirm}
              style={[
                styles.btn,
                {
                  backgroundColor: destructive
                    ? "rgba(239,68,68,0.18)"
                    : c.primary,
                  opacity: busy ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  {
                    color: destructive ? "#FF453A" : c.primaryForeground,
                  },
                ]}
              >
                {busy ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    paddingHorizontal: 10,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
