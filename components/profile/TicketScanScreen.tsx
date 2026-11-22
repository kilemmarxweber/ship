import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconBackButton } from "@/components/ui/IconBackButton";
import { api } from "@/src/api";
import { useRequireSession } from "@/src/require-session";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

function CameraScan({
  onScan,
  last,
}: {
  onScan: (payload: string) => void;
  last: string;
}) {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");

  return (
    <>
      {!permission?.granted ? (
        <Pressable style={styles.perm} onPress={() => void requestPermission()}>
          <Text style={{ color: c.text }}>
            Autoriser la caméra pour le scan
          </Text>
        </Pressable>
      ) : (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            if (data) onScan(data);
          }}
        />
      )}
      <View style={{ padding: 16, gap: 8 }}>
        <TextInput
          value={manual}
          onChangeText={setManual}
          placeholder="SHIPSHOP-TIX|…"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text, borderColor: c.textMuted }]}
          onSubmitEditing={() => onScan(manual)}
        />
        {last ? <Text style={{ color: c.emerald }}>{last}</Text> : null}
      </View>
    </>
  );
}

export function TicketScanScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { allowed } = useRequireSession();
  const [last, setLast] = useState("");
  const lock = useRef(false);

  async function submit(payload: string) {
    const code = payload.trim();
    if (!code || lock.current) return;
    lock.current = true;
    try {
      const data = await api<{
        ticket?: { buyerName: string; type: string };
      }>("/api/admin/tickets/check-in", {
        method: "POST",
        body: JSON.stringify({ payload: code }),
      });
      const msg = `${data.ticket?.buyerName ?? "OK"} · ${data.ticket?.type ?? ""}`;
      setLast(msg);
      showToast(msg);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Scan refusé");
    } finally {
      setTimeout(() => {
        lock.current = false;
      }, 1200);
    }
  }

  if (!allowed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: insets.top,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}
    >
      <IconBackButton color={c.text} style={styles.back} />
      <CameraScan onScan={(value) => void submit(value)} last={last} />
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: 6, marginTop: 4 },
  camera: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  perm: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 10 },
});
