import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

export function LiveCover({ cover }: { cover?: string | null }) {
  if (cover) {
    return (
      <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" />
    );
  }
  return <View style={[styles.fill, styles.fallback]} />;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  fallback: { backgroundColor: "#121218" },
});
