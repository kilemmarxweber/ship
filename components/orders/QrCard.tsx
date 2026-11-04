import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { qrImageUrl } from "@/src/handover";

export function QrCard({
  payload,
  code,
  hint,
}: {
  payload: string;
  code?: string | null;
  hint?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="qr-code" size={16} color="#00D68F" />
        <Text style={styles.code}>{(code ?? "QR remise").toUpperCase()}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.frame}>
        <Image
          source={{ uri: qrImageUrl(payload, 280) }}
          style={styles.qr}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(0,214,143,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.28)",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  code: {
    color: "#00D68F",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  hint: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  frame: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
  },
  qr: { width: 220, height: 220 },
});
