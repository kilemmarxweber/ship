import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { colors } from "@/src/theme";

export function LiveWaiting({
  avatar,
  isHost,
  onRetry,
}: {
  avatar?: string | null;
  isHost?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.root, { backgroundColor: "#0B0B10" }]}>
      <View style={styles.card}>
        <View style={styles.ring}>
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={styles.face}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.face, styles.faceEmpty]} />
          )}
        </View>
        <View style={styles.liveDot}>
          <View style={styles.livePulse} />
          <Text style={styles.liveDotText}>LIVE</Text>
        </View>
        <ActivityIndicator color="#00D68F" />
        <Text style={styles.title}>
          {isHost ? "Ton live est en cours" : "Live en cours"}
        </Text>
        <Text style={styles.body}>
          {isHost
            ? "On allume la caméra. Un instant, la vidéo arrive…"
            : "On charge la vidéo. Un peu de patience…"}
        </Text>
        {onRetry && !isHost ? (
          <Pressable style={styles.retry} onPress={onRetry} hitSlop={8}>
            <Ionicons name="refresh" size={16} color="#05140F" />
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "86%",
    maxWidth: 340,
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(18,18,24,0.72)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  ring: {
    padding: 4,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(255,69,58,0.75)",
  },
  face: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  faceEmpty: { backgroundColor: "rgba(255,255,255,0.12)" },
  liveDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.live,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  liveDotText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  title: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retry: {
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#00D68F",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryText: { color: "#05140F", fontWeight: "800" },
});
