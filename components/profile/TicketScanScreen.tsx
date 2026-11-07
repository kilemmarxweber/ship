import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

type CameraApi = typeof import("expo-camera");

function loadCamera(): CameraApi | null {
  try {
    return require("expo-camera") as CameraApi;
  } catch {
    return null;
  }
}

const cameraApi = loadCamera();

function ManualEntry({
  onSubmit,
  last,
}: {
  onSubmit: (payload: string) => void;
  last: string;
}) {
  const c = useColors();
  const [manual, setManual] = useState("");
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>
        Caméra indisponible ici — colle le code du billet, ou rebuild native
        (`npx expo run:android`) pour scanner.
      </Text>
      <TextInput
        value={manual}
        onChangeText={setManual}
        placeholder="SHIPSHOP-TIX|…"
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text, borderColor: c.textMuted }]}
        onSubmitEditing={() => onSubmit(manual)}
      />
      <Pressable
        style={[styles.perm, { backgroundColor: c.card }]}
        onPress={() => onSubmit(manual)}
      >
        <Text style={{ color: c.emerald, fontWeight: "800" }}>Valider</Text>
      </Pressable>
      {last ? <Text style={{ color: c.emerald }}>{last}</Text> : null}
    </View>
  );
}

function CameraScan({
  onScan,
  last,
}: {
  onScan: (payload: string) => void;
  last: string;
}) {
  const c = useColors();
  const CameraView = cameraApi!.CameraView;
  const [permission, requestPermission] = cameraApi!.useCameraPermissions();
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
  const t = useT();
  const c = useColors();
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

  return (
    <View
      style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}
    >
      <Pressable onPress={() => safeBack()} style={{ padding: 16 }}>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>{t("back")}</Text>
      </Pressable>
      {cameraApi ? (
        <CameraScan onScan={(value) => void submit(value)} last={last} />
      ) : (
        <ManualEntry onSubmit={(value) => void submit(value)} last={last} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
