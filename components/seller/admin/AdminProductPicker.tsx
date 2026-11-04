import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

export type AdminProductHit = {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  category?: string;
  shop: { name: string };
};

export function AdminProductPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: AdminProductHit | null;
  onSelect: (product: AdminProductHit) => void;
  onClear: () => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AdminProductHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ status: "ACTIVE" });
          if (q.trim()) params.set("q", q.trim());
          const data = await api<{ products?: AdminProductHit[] }>(
            `/api/admin/products?${params}`,
          );
          setHits((data.products ?? []).slice(0, 12));
        } catch {
          setHits([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [open, q]);

  if (selected) {
    const cover = mediaUrl(selected.images[0]);
    return (
      <View
        style={[
          styles.selected,
          { borderColor: HAIRLINE, backgroundColor: "rgba(127,127,140,0.1)" },
        ]}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View
            style={[styles.thumb, { backgroundColor: "rgba(127,127,140,0.2)" }]}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: c.text, fontWeight: "700", fontSize: 13 }}
            numberOfLines={1}
          >
            {selected.title}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 11 }} numberOfLines={1}>
            {selected.shop.name} ·{" "}
            {formatMoney(selected.priceCents, selected.currency)}
          </Text>
        </View>
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.openBtn,
          { borderColor: HAIRLINE, backgroundColor: c.card },
        ]}
      >
        <Ionicons name="search" size={16} color={c.textMuted} />
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
          Choisir un produit ACTIVE
        </Text>
      </Pressable>
      {open ? (
        <View
          style={[
            styles.panel,
            { borderColor: HAIRLINE, backgroundColor: c.sheet },
          ]}
        >
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher…"
            placeholderTextColor={c.textMuted}
            autoFocus
            style={[
              styles.input,
              { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
            ]}
          />
          {loading ? (
            <ActivityIndicator
              color={c.primary}
              style={{ marginVertical: 12 }}
            />
          ) : (
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {hits.length === 0 ? (
                <Text
                  style={{
                    color: c.textMuted,
                    textAlign: "center",
                    padding: 12,
                  }}
                >
                  Aucun produit
                </Text>
              ) : (
                hits.map((p) => {
                  const cover = mediaUrl(p.images[0]);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        onSelect(p);
                        setOpen(false);
                        setQ("");
                      }}
                      style={styles.hit}
                    >
                      {cover ? (
                        <Image
                          source={{ uri: cover }}
                          style={styles.hitThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.hitThumb,
                            { backgroundColor: "rgba(127,127,140,0.2)" },
                          ]}
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: c.text,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                          numberOfLines={1}
                        >
                          {p.title}
                        </Text>
                        <Text
                          style={{ color: c.textMuted, fontSize: 11 }}
                          numberOfLines={1}
                        >
                          {p.shop.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
          <Pressable
            onPress={() => setOpen(false)}
            style={{ paddingVertical: 8 }}
          >
            <Text
              style={{
                color: c.primary,
                textAlign: "center",
                fontWeight: "700",
              }}
            >
              Fermer
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  openBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  panel: { borderWidth: 1, borderRadius: 14, padding: 8 },
  input: {
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  hit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  hitThumb: { width: 32, height: 32, borderRadius: 8 },
});
