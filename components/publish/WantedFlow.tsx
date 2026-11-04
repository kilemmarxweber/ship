import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ParcelMap } from "@/components/orders/ParcelMap";
import { MediaStrip } from "@/components/publish/MediaStrip";
import { api } from "@/src/api";
import {
    geoErrorCode,
    getDeviceCoords,
    openAppPermissionSettings,
    openDeviceLocationSettings,
} from "@/src/geo";
import { priceToCents, sanitizePriceInput } from "@/src/product-options";
import { categories, colors, HAIRLINE, type ThemeColors } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { WANTED_FEED_KEY } from "@/src/wanted";

const WANTED_BATCH_MAX = 8;

type Condition = "NEW_SHOP" | "USED" | "";
type Draft = {
  key: string;
  title: string;
  description: string;
  images: string[];
  category: (typeof categories)[number];
  budget: string;
  condition: Condition;
  busy: boolean;
};

function emptyDraft(): Draft {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: "",
    description: "",
    images: [],
    category: "Tech",
    budget: "",
    condition: "",
    busy: false,
  };
}

export function WantedFlow({ onBack }: { onBack: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeWantedStyles(c), [c]);
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Draft[]>([emptyDraft()]);
  const [city, setCity] = useState("Kinshasa");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [avenue, setAvenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  function revealPublish() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 320);
  }

  async function captureGps() {
    if (locating) return;
    revealPublish();
    setLocating(true);
    try {
      const position = await getDeviceCoords();
      const nextLat = position.latitude;
      const nextLng = position.longitude;
      setLat(nextLat);
      setLng(nextLng);
      setAccuracyM(position.accuracy);
      revealPublish();
      try {
        const geo = await api<{
          city?: string;
          commune?: string;
          quartier?: string;
          avenue?: string;
        }>(
          `/api/geo/reverse?lat=${encodeURIComponent(String(nextLat))}&lng=${encodeURIComponent(String(nextLng))}`,
        );
        if (geo.city?.trim()) setCity(geo.city.trim());
        if (geo.commune?.trim()) setCommune(geo.commune.trim());
        if (geo.quartier?.trim()) setQuartier(geo.quartier.trim());
        if (geo.avenue?.trim()) setAvenue(geo.avenue.trim());
        showToast("Point GPS enregistré", "success");
      } catch {
        showToast(
          "Position GPS OK — complète commune / quartier à la main",
          "info",
        );
      }
    } catch (cause) {
      const code = geoErrorCode(cause);
      if (code === "permission") {
        Alert.alert(
          "Autorisation requise",
          "ShipShop n’a pas encore l’accès à ta position. Autorise la localisation pour cette application.",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Autoriser dans Réglages",
              onPress: () => void openAppPermissionSettings(),
            },
          ],
        );
      } else if (code === "services") {
        Alert.alert(
          "Localisation désactivée",
          "Le GPS du téléphone est éteint. Active-le puis appuie encore sur Ma position.",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Ouvrir la localisation",
              onPress: () => void openDeviceLocationSettings(),
            },
          ],
        );
      } else {
        showToast(
          "Position introuvable. Réessaie dans quelques secondes.",
          "error",
        );
      }
    } finally {
      setLocating(false);
      revealPublish();
    }
  }

  function patch(key: string, next: Partial<Draft>) {
    setProducts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...next } : item)),
    );
  }

  async function submit() {
    if (loading) return;
    const items: {
      title: string;
      description: string | null;
      images: string[];
      category: string;
      budgetCents: number;
      condition: "NEW_SHOP" | "USED";
    }[] = [];
    for (let i = 0; i < products.length; i += 1) {
      const item = products[i];
      const budgetCents = priceToCents(item.budget);
      if (item.title.trim().length < 2) {
        showToast(`Produit ${i + 1} : indique un titre`, "error");
        return;
      }
      if (!item.condition) {
        showToast(`Produit ${i + 1} : neuf / magasin ou occasion`, "error");
        return;
      }
      if (budgetCents < 100) {
        showToast(`Produit ${i + 1} : budget minimum 1 $`, "error");
        return;
      }
      items.push({
        title: item.title.trim(),
        description: item.description.trim() || null,
        images: item.images,
        category: item.category,
        budgetCents,
        condition: item.condition,
      });
    }
    setLoading(true);
    try {
      const data = await api<{
        request?: { id: string };
        requests?: { id: string }[];
      }>("/api/wanted", {
        method: "POST",
        body: JSON.stringify({
          items,
          city: city.trim() || "Kinshasa",
          commune: commune.trim() || null,
          quartier: quartier.trim() || null,
          avenue: avenue.trim() || null,
        }),
      });
      const first = data.request ?? data.requests?.[0];
      if (!first) {
        showToast("Publication impossible", "error");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: WANTED_FEED_KEY });
      const n = data.requests?.length ?? 1;
      const cover = items[0]?.images?.[0] ?? null;
      setProducts([emptyDraft()]);
      setCity("Kinshasa");
      setCommune("");
      setQuartier("");
      setAvenue("");
      setLat(null);
      setLng(null);
      setAccuracyM(null);
      showToast(
        n > 1
          ? `${n} demandes publiées — touche pour voir`
          : "Demande publiée — touche pour voir",
        "success",
        {
          href: `/wanted/${first.id}` as Href,
          image: cover,
          label: "Voir la demande",
        },
      );
      onBack();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Publication impossible",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={onBack} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={styles.backText} numberOfLines={1}>
          Retour{"\u00A0"}
        </Text>
      </Pressable>
      <Text style={styles.title}>Je cherche</Text>

      {products.map((item, index) => (
        <Animated.View
          key={item.key}
          entering={FadeInDown.delay(index * 60).springify()}
          style={styles.card}
        >
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Produit {index + 1}</Text>
            {products.length > 1 ? (
              <Pressable
                onPress={() =>
                  setProducts((current) =>
                    current.filter((row) => row.key !== item.key),
                  )
                }
                style={styles.remove}
              >
                <Ionicons name="trash-outline" size={16} color="#fb7185" />
                <Text style={styles.removeText}>Retirer</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput
            value={item.title}
            onChangeText={(title) => patch(item.key, { title })}
            placeholder="ex: nom de produit"
            placeholderTextColor={c.textMuted}
            style={styles.input}
            autoFocus={index === 0}
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={styles.label}>Photos (optionnel)</Text>
          <MediaStrip
            urls={item.images}
            onChange={(images) => patch(item.key, { images })}
            max={8}
            kind="images"
            busy={item.busy}
            setBusy={(busy) => patch(item.key, { busy })}
          />
          <View style={styles.rowWrap}>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => patch(item.key, { category: cat })}
                style={[styles.chip, item.category === cat && styles.chipOn]}
              >
                <Text
                  style={[
                    styles.chipText,
                    item.category === cat && styles.chipTextOn,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>État souhaité</Text>
          <View style={styles.condRow}>
            <Pressable
              onPress={() => patch(item.key, { condition: "NEW_SHOP" })}
              style={[
                styles.cond,
                item.condition === "NEW_SHOP" && styles.condOn,
              ]}
            >
              <Ionicons
                name="storefront-outline"
                size={18}
                color={item.condition === "NEW_SHOP" ? "#04281c" : "#fff"}
              />
              <Text
                style={[
                  styles.condText,
                  item.condition === "NEW_SHOP" && styles.condTextOn,
                ]}
              >
                Neuf / magasin
              </Text>
            </Pressable>
            <Pressable
              onPress={() => patch(item.key, { condition: "USED" })}
              style={[styles.cond, item.condition === "USED" && styles.condOn]}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={item.condition === "USED" ? "#04281c" : "#fff"}
              />
              <Text
                style={[
                  styles.condText,
                  item.condition === "USED" && styles.condTextOn,
                ]}
              >
                Occasion
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={item.budget}
            onChangeText={(budget) =>
              patch(item.key, { budget: sanitizePriceInput(budget) })
            }
            placeholder="Budget max (USD)"
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            value={item.description}
            onChangeText={(description) => patch(item.key, { description })}
            placeholder="Couleur, taille, modèle…"
            placeholderTextColor={c.textMuted}
            style={[styles.input, styles.area]}
            multiline
          />
        </Animated.View>
      ))}

      <View style={styles.actionRow}>
        <Pressable
          style={styles.gpsBtn}
          onPress={() => void captureGps()}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <Ionicons name="locate" size={18} color={c.primaryForeground} />
          )}
          <Text style={styles.gpsText} numberOfLines={1}>
            {locating ? "GPS…" : "Ma position"}
          </Text>
        </Pressable>
        {products.length < WANTED_BATCH_MAX ? (
          <Pressable
            style={styles.add}
            onPress={() => setProducts((current) => [...current, emptyDraft()])}
          >
            <Ionicons name="add" size={18} color={c.primary} />
            <Text style={styles.addText} numberOfLines={1}>
              Ajouter un autre
            </Text>
          </Pressable>
        ) : null}
      </View>

      {lat != null && lng != null ? (
        <View style={styles.pointBox}>
          <ParcelMap
            mode="pin"
            courier={null}
            destination={{ lat, lng }}
            label={
              accuracyM != null
                ? `Tu es ici · ~${Math.round(accuracyM)} m`
                : "Tu es ici"
            }
          />
          <Text style={styles.pointMeta}>
            Point GPS {lat.toFixed(6)}, {lng.toFixed(6)}
            {accuracyM != null
              ? ` · précision ~${Math.round(accuracyM)} m`
              : ""}
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>Adresse (complément)</Text>
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="Ville"
        placeholderTextColor={c.textMuted}
        style={styles.input}
      />
      <TextInput
        value={commune}
        onChangeText={setCommune}
        placeholder="Commune"
        placeholderTextColor={c.textMuted}
        style={styles.input}
      />
      <TextInput
        value={quartier}
        onChangeText={setQuartier}
        placeholder="Quartier"
        placeholderTextColor={c.textMuted}
        style={styles.input}
      />
      <TextInput
        value={avenue}
        onChangeText={setAvenue}
        placeholder="Avenue"
        placeholderTextColor={c.textMuted}
        style={styles.input}
      />

      <Pressable
        style={[styles.cta, loading && { opacity: 0.7 }]}
        disabled={loading}
        onPress={() => void submit()}
      >
        <Text style={styles.ctaText}>
          {loading
            ? "Publication…"
            : products.length > 1
              ? "Publier les demandes"
              : "Publier la demande"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function makeWantedStyles(c: ThemeColors = colors) {
  return StyleSheet.create({
    wrap: { gap: 12, paddingBottom: 28 },
    back: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingRight: 16,
      overflow: "visible",
    },
    backText: {
      color: c.text,
      fontWeight: "700",
      includeFontPadding: false,
      paddingRight: 12,
      flexShrink: 0,
    },
    title: { color: c.text, fontSize: 26, fontWeight: "800" },
    lead: { color: c.textMuted, lineHeight: 20 },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    cardHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { color: c.text, fontWeight: "800" },
    remove: { flexDirection: "row", alignItems: "center", gap: 4 },
    removeText: { color: c.live, fontSize: 12, fontWeight: "700" },
    input: {
      backgroundColor: c.card,
      borderRadius: 14,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    area: { minHeight: 72, textAlignVertical: "top" },
    rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.text, fontWeight: "800", fontSize: 12 },
    chipTextOn: { color: c.primaryForeground },
    condRow: { flexDirection: "row", gap: 8 },
    cond: {
      flex: 1,
      borderRadius: 16,
      padding: 12,
      gap: 6,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    condOn: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    condText: { color: c.text, fontWeight: "800", fontSize: 13 },
    condTextOn: { color: c.primaryForeground },
    actionRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
    gpsBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: c.primary,
      paddingHorizontal: 10,
    },
    gpsText: { color: c.primaryForeground, fontWeight: "800", flexShrink: 0 },
    add: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: `${c.primary}55`,
    },
    addText: { color: c.primary, fontWeight: "700", flexShrink: 0 },
    pointBox: { gap: 8 },
    pointMeta: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
    },
    label: { color: c.textMuted, fontWeight: "700", fontSize: 12 },
    cta: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    ctaText: { color: c.primaryForeground, fontWeight: "800" },
  });
}
