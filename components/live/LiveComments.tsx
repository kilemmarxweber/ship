import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    type ScrollViewInstance,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { mediaUrl } from "@/src/api";
import type { LiveChat } from "@/src/live";

const NAME_COLORS = [
  "#5B8CFF",
  "#FF7AB6",
  "#FFB020",
  "#3DDC97",
  "#C084FC",
  "#38BDF8",
];

function nameColor(id: string) {
  let hash = 0;
  for (const char of id)
    hash = (hash + char.charCodeAt(0)) % NAME_COLORS.length;
  return NAME_COLORS[hash] ?? NAME_COLORS[0];
}

export function LiveComments({
  chats,
  hostUserId,
}: {
  chats: LiveChat[];
  hostUserId?: string;
}) {
  const list = useRef<ScrollViewInstance>(null);
  const pinned = useRef(true);

  function followLatest() {
    if (!pinned.current) return;
    list.current?.scrollToEnd({ animated: true });
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    pinned.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
  }

  useEffect(() => {
    followLatest();
  }, [chats.length]);

  if (!chats.length) return null;

  return (
    <ScrollView
      ref={list}
      style={styles.stack}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={followLatest}
    >
      {chats.map((row) => {
        const seller = Boolean(hostUserId && row.user.id === hostUserId);
        const face = mediaUrl(row.user.image);
        return (
          <View key={row.id} style={styles.row}>
            {face ? (
              <Image source={{ uri: face }} style={styles.face} />
            ) : (
              <View style={styles.face} />
            )}
            <View style={styles.col}>
              {seller ? (
                <View style={styles.sellerLine}>
                  <View style={styles.sellerBadge}>
                    <Text style={styles.sellerBadgeText}>Vendeur</Text>
                  </View>
                  <Text style={styles.sellerBody}>{row.body}</Text>
                </View>
              ) : (
                <>
                  <Text
                    style={[styles.name, { color: nameColor(row.user.id) }]}
                    numberOfLines={1}
                  >
                    {row.user.name}
                  </Text>
                  <Text style={styles.body}>{row.body}</Text>
                </>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    maxHeight: 240,
    width: "72%",
    alignSelf: "flex-start",
  },
  content: {
    justifyContent: "flex-end",
    gap: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    maxWidth: "88%",
  },
  face: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  col: { flex: 1, minWidth: 0, gap: 1 },
  name: {
    fontWeight: "800",
    fontSize: 13,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  body: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sellerLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  sellerBadge: {
    backgroundColor: "#3B82F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sellerBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  sellerBody: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
