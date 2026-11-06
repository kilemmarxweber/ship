import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveFilterOverlay } from "@/components/live/LiveFilterOverlay";
import { AR_FILTERS } from "@/src/live-ar-filters";
import { showToast } from "@/src/toast";

/**
 * Studio AR autonome (caméra frontale + galerie filtres + photo).
 * Landmarks MediaPipe / VisionCamera = vague native suivante ;
 * ici ancrage approximatif + même catalogue que le Live.
 */
export function ArStudioScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [filterId, setFilterId] = useState("crown");
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function ensureLibrary() {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await MediaLibrary.requestPermissionsAsync();
    return asked.granted;
  }

  async function takePhoto() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("Capture impossible");
      if (await ensureLibrary()) {
        await MediaLibrary.saveToLibraryAsync(photo.uri);
        showToast("Photo enregistrée dans la galerie", "info");
      } else {
        showToast("Photo prise — autorise la galerie pour sauvegarder", "info");
      }
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Capture impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecord() {
    if (!cameraRef.current || busy) return;
    if (recording) {
      setBusy(true);
      try {
        cameraRef.current.stopRecording();
      } finally {
        setRecording(false);
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      setRecording(false);
      if (video?.uri && (await ensureLibrary())) {
        await MediaLibrary.saveToLibraryAsync(video.uri);
        showToast("Vidéo enregistrée (filtre visible à l’écran)", "info");
      }
    } catch (cause) {
      setRecording(false);
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#00D68F" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: 24 }]}>
        <Text style={styles.permTitle}>Caméra requise</Text>
        <Text style={styles.permBody}>
          Autorise la caméra pour tester les filtres AR (chapeau, lunettes,
          emojis).
        </Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permBtnText}>Autoriser</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700" }}>
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />
      <LiveFilterOverlay look={filterId} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Studio AR</Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() =>
            setFacing((value) => (value === "front" ? "back" : "front"))
          }
        >
          <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gallery}
        >
          {AR_FILTERS.map((item) => {
            const on = filterId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilterId(item.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={styles.chipEmoji}>{item.emoji}</Text>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.controls}>
          <Pressable
            style={styles.sideBtn}
            onPress={() => setFilterId("none")}
          >
            <Text style={styles.sideBtnText}>Aucun</Text>
          </Pressable>
          <Pressable
            style={[styles.shutter, busy && { opacity: 0.6 }]}
            onPress={() => void takePhoto()}
            disabled={busy || recording}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            style={[styles.sideBtn, recording && styles.recOn]}
            onPress={() => void toggleRecord()}
            disabled={busy && !recording}
          >
            <Text style={styles.sideBtnText}>
              {recording ? "Stop" : "Vidéo"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Photo / vidéo : le filtre reste à l’écran. Bake pixel-perfect +
          MediaPipe = prochain rebuild natif.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    gap: 12,
  },
  gallery: { paddingHorizontal: 14, gap: 8 },
  chip: {
    width: 72,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    gap: 4,
  },
  chipOn: {
    backgroundColor: "#00D68F",
    borderColor: "#00D68F",
  },
  chipEmoji: { fontSize: 20 },
  chipLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "800",
  },
  chipLabelOn: { color: "#04281c" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 20,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  sideBtn: {
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  recOn: { backgroundColor: "rgba(239,68,68,0.85)" },
  sideBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  hint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    paddingHorizontal: 24,
  },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  permBody: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  permBtn: {
    marginTop: 20,
    backgroundColor: "#00D68F",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  permBtnText: { color: "#04281c", fontWeight: "800" },
});
