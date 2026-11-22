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
import { IconBackButton } from "@/components/ui/IconBackButton";
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
  const [step, setStep] = useState(0);
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

  function nextStep() {
    const item = products[0];
    if (!item) return;
    if (step === 0 && item.title.trim().length < 2) {
      showToast("Indique ce que tu recherches", "error");
      return;
    }
    if (step === 1) {
      if (!item.condition) {
        showToast("Choisis l’état souhaité", "error");
        return;
      }
      if (priceToCents(item.budget) < 100) {
        showToast("Indique un budget minimum de 1 $", "error");
        return;
      }
    }
    setStep((value) => Math.min(2, value + 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
      setStep(0);
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

  const item = products[0] ?? emptyDraft();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <IconBackButton color={c.text} onPress={onBack} />
      <Text style={styles.title}>Je cherche</Text>
      <View style={styles.steps}>
        {["Besoin", "Budget", "Lieu"].map((label, index) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, index <= step && styles.stepDotOn]}>
              <Text style={[styles.stepNumber, index <= step && styles.stepNumberOn]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, index <= step && styles.stepLabelOn]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Que recherches-tu ?</Text>
          <Text style={styles.lead}>
            Un titre précis et une photo aident les vendeurs à répondre vite.
          </Text>
          <TextInput
            value={item.title}
            onChangeText={(title) => patch(item.key, { title })}
            placeholder="Ex. AirPods Pro 2"
            placeholderTextColor={c.textMuted}
            style={styles.input}
            autoFocus
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
          <TextInput
            value={item.description}
            onChangeText={(description) => patch(item.key, { description })}
            placeholder="Modèle, couleur, taille ou détails utiles…"
            placeholderTextColor={c.textMuted}
            style={[styles.input, styles.area]}
            multiline
          />
        </Animated.View>
      ) : null}

      {step === 1 ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Budget et préférences</Text>
          <Text style={styles.label}>Catégorie</Text>
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
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Où recevoir les offres ?</Text>
              <Text style={styles.lead}>
                La commune suffit. Le GPS reste facultatif.
              </Text>
            </View>
          </View>
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
              {locating ? "Localisation…" : "Utiliser ma position"}
            </Text>
          </Pressable>

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
                Position enregistrée
                {accuracyM != null
                  ? ` · précision ~${Math.round(accuracyM)} m`
                  : ""}
              </Text>
            </View>
          ) : null}

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
            placeholder="Quartier (facultatif)"
            placeholderTextColor={c.textMuted}
            style={styles.input}
          />
          <TextInput
            value={avenue}
            onChangeText={setAvenue}
            placeholder="Avenue (facultatif)"
            placeholderTextColor={c.textMuted}
            style={styles.input}
          />

          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <Ionicons name="search" size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.summaryMeta}>
                {item.condition === "USED" ? "Occasion" : "Neuf / magasin"} ·
                max {item.budget || "—"} USD
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.navRow}>
        {step > 0 ? (
          <Pressable
            accessibilityLabel="Retour"
            style={[styles.secondaryCta, styles.iconCta]}
            onPress={() => setStep(step - 1)}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </Pressable>
        ) : null}
        {step < 2 ? (
          <Pressable style={styles.cta} onPress={nextStep}>
            <Text style={styles.ctaText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={17} color={c.primaryForeground} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.cta, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={() => void submit()}
          >
            {loading ? <ActivityIndicator color={c.primaryForeground} /> : null}
            <Text style={styles.ctaText}>
              {loading ? "Publication…" : "Publier la demande"}
            </Text>
          </Pressable>
        )}
      </View>
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
    steps: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    stepItem: { flex: 1, alignItems: "center", gap: 5 },
    stepDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    stepDotOn: { backgroundColor: c.primary, borderColor: c.primary },
    stepNumber: { color: c.textMuted, fontSize: 12, fontWeight: "800" },
    stepNumberOn: { color: c.primaryForeground },
    stepLabel: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
    stepLabelOn: { color: c.text },
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
    summary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      padding: 12,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    summaryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${c.primary}18`,
    },
    summaryTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    summaryMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    navRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    cta: {
      flex: 1,
      minHeight: 50,
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 16,
      alignItems: "center",
    },
    ctaText: { color: c.primaryForeground, fontWeight: "800" },
    iconCta: { width: 44, minWidth: 44, paddingHorizontal: 0 },
    secondaryCta: {
      minHeight: 50,
      minWidth: 104,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
  });
}
