import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
    getPermissionsAsync,
    requestPermissionsAsync,
    saveToLibraryAsync,
} from "expo-media-library";
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
import { useLiveFacePose } from "@/src/use-live-face-pose";

/**
 * Studio AR autonome (caméra frontale + galerie filtres + photo).
 * Ancres tête / yeux / oreilles via tracking lissé.
 * `ingestLandmarks(MediaPipe)` prêt pour le rebuild natif (sans double caméra Live).
 */
export function ArStudioScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [filterId, setFilterId] = useState("crown");
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const { pose } = useLiveFacePose({ enabled: true, hz: 24 });

  useEffect(() => {
    if (permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function ensureLibrary() {
    const current = await getPermissionsAsync();
    if (current.granted) return true;
    const asked = await requestPermissionsAsync();
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
        await saveToLibraryAsync(photo.uri);
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
        await saveToLibraryAsync(video.uri);
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
        <Pressable
          style={styles.permBtn}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.permBtnText}>Autoriser</Text>
        </Pressable>
        <Pressable onPress={() => safeBack()} style={{ marginTop: 16 }}>
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
      <LiveFilterOverlay look={filterId} pose={pose} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={() => safeBack()}>
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
                style={styles.chipWrap}
                accessibilityLabel={item.name}
              >
                <View style={[styles.chip, on && styles.chipOn]}>
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>
                </View>
                <Text
                  style={[styles.chipLabel, on && styles.chipLabelOn]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.controls}>
          <Pressable style={styles.sideBtn} onPress={() => setFilterId("none")}>
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
          Ancres tête / yeux / oreilles actives. MediaPipe Face Landmarker =
          prochaine vague native (sans double capture Live).
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
  gallery: { paddingHorizontal: 14, gap: 10, alignItems: "flex-end" },
  chipWrap: {
    width: 56,
    alignItems: "center",
    gap: 6,
  },
  chip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: "#00D68F",
    borderColor: "#fff",
  },
  chipEmoji: { fontSize: 22 },
  chipLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  chipLabelOn: { color: "#00D68F" },
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
