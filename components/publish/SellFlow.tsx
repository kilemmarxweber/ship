import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import type { Href } from "expo-router";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { MediaStrip } from "@/components/publish/MediaStrip";
import {
    MusicStudio,
    uploadLocalSoundtrack,
} from "@/components/publish/MusicStudio";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import {
    APP_CURRENCIES,
    CLOTHING_SIZES,
    PRESET_COLORS,
    priceToCents,
    sanitizePriceInput,
    SHOE_SIZES,
    type AppCurrency,
} from "@/src/product-options";
import {
    LOCAL_SOUNDTRACK_ID,
    normalizeMotions,
    type LocalSoundtrackClip,
} from "@/src/soundtrack";
import {
    categories,
    categoryLooks,
    colors,
    HAIRLINE,
    type ThemeColors,
} from "@/src/theme";
import { showToast } from "@/src/toast";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

export type SellShop = {
  id: string;
  name: string;
  currency?: string;
};

export function SellFlow({
  shops,
  initialShopId,
  onBack,
  onNeedShop,
}: {
  shops: SellShop[];
  initialShopId?: string;
  onBack: () => void;
  onNeedShop: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeSellStyles(c), [c]);
  const [step, setStep] = useState(1);
  const [shopId, setShopId] = useState(
    shops.some((shop) => shop.id === initialShopId)
      ? initialShopId!
      : (shops[0]?.id ?? ""),
  );
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<AppCurrency>(
    (shops[0]?.currency as AppCurrency) || "USD",
  );
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<(typeof categories)[number]>("Tech");
  const [description, setDescription] = useState("");
  const [pickedColors, setPickedColors] = useState<string[]>([]);
  const [pickedSizes, setPickedSizes] = useState<string[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [soundtrackStartMs, setSoundtrackStartMs] = useState(0);
  const [localClip, setLocalClip] = useState<LocalSoundtrackClip | null>(null);
  const [imageMotions, setImageMotions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const shop = useMemo(
    () => shops.find((item) => item.id === shopId) ?? shops[0],
    [shops, shopId],
  );

  function toggle(
    list: string[],
    value: string,
    set: (next: string[]) => void,
  ) {
    set(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value],
    );
  }

  async function save(status: "DRAFT" | "ACTIVE") {
    const priceCents = priceToCents(price);
    if (mediaBusy) {
      showToast("Patiente : upload média en cours", "error");
      return;
    }
    if (!shopId) {
      onNeedShop();
      return;
    }
    if (!images.length) {
      showToast("Ajoute au moins une photo ou vidéo", "error");
      return;
    }
    if (title.trim().length < 2) {
      showToast("Indique un titre", "error");
      return;
    }
    if (priceCents < 100) {
      showToast(`Prix minimum 1 ${currency}`, "error");
      return;
    }
    setBusy(true);
    try {
      let publishedSoundtrackId = soundtrackId;
      let publishedStartMs = soundtrackId ? soundtrackStartMs : 0;
      if (soundtrackId === LOCAL_SOUNDTRACK_ID) {
        if (!localClip) {
          showToast("Son temporaire introuvable — réimporte", "error");
          return;
        }
        publishedSoundtrackId = await uploadLocalSoundtrack(
          localClip,
          soundtrackStartMs,
        );
        publishedStartMs = 0;
      }
      const posted = await api<{ product?: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          title: title.trim(),
          description: description.trim() || undefined,
          priceCents,
          currency,
          quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
          category,
          images: [...new Set(images.map((url) => url.trim()).filter(Boolean))],
          colors: pickedColors,
          sizes: pickedSizes,
          location: "Kinshasa",
          soundtrackId: publishedSoundtrackId,
          soundtrackStartMs: publishedStartMs,
          imageMotions: normalizeMotions(images.length, imageMotions),
          status,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      const cover = posted.product?.images?.[0] ?? images[0] ?? null;
      const productId = posted.product?.id;
      setStep(1);
      setTitle("");
      setImages([]);
      setPrice("");
      setQuantity("1");
      setCategory("Tech");
      setDescription("");
      setPickedColors([]);
      setPickedSizes([]);
      setOptionsOpen(false);
      setSoundtrackId(null);
      setSoundtrackStartMs(0);
      setLocalClip(null);
      setImageMotions([]);
      if (status === "DRAFT") {
        showToast("Brouillon enregistré", "success");
        onBack();
        return;
      }
      showToast(
        "Produit publié — touche pour voir",
        "success",
        productId
          ? {
              href: `/product/${productId}` as Href,
              image: cover,
              label: "Voir la publication",
            }
          : undefined,
      );
      onBack();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Publication impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => (step > 1 ? setStep((value) => value - 1) : onBack())}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={styles.backText} numberOfLines={1}>
          {step > 1 ? "Étape précédente" : "Retour"}
          {"\u00A0"}
        </Text>
      </Pressable>

      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.bar,
              n < step && styles.barDone,
              n === step && styles.barNow,
            ]}
          />
        ))}
      </View>
      <Text style={styles.kicker}>
        {step === 1
          ? "Vidéo · 1/3"
          : step === 2
            ? "Prix · 2/3"
            : "Poster · 3/3"}
      </Text>
      <Text style={styles.title}>
        {step === 1
          ? "Contenu d’article"
          : step === 2
            ? "Prix & détails"
            : "Poster"}
      </Text>

      {step === 1 ? (
        <Animated.View entering={FadeInRight.springify()} style={styles.block}>
          <Text style={styles.label}>Boutique</Text>
          <ShopPicker
            shops={shops}
            value={shopId}
            placeholder="Rechercher une boutique"
            onChange={(id) => {
              setShopId(id);
              const next = shops.find((item) => item.id === id);
              if (next?.currency) setCurrency(next.currency as AppCurrency);
            }}
          />
          <Text style={styles.label}>Images / vidéos</Text>
          <MediaStrip
            urls={images}
            onChange={setImages}
            kind="mixed"
            busy={mediaBusy}
            setBusy={setMediaBusy}
          />
          <MusicStudio
            productTitle={title}
            images={images}
            soundtrackId={soundtrackId}
            onSoundtrackId={setSoundtrackId}
            startMs={soundtrackStartMs}
            onStartMs={setSoundtrackStartMs}
            localClip={localClip}
            onLocalClip={setLocalClip}
            imageMotions={imageMotions}
            onImageMotions={setImageMotions}
          />
          <Pressable
            style={[
              styles.cta,
              (!shopId || !images.length || mediaBusy) && { opacity: 0.5 },
            ]}
            disabled={!shopId || !images.length || mediaBusy}
            onPress={() => setStep(2)}
          >
            <Text style={styles.ctaText} numberOfLines={1}>
              {mediaBusy ? "Upload en cours…" : "Suivant"}
              {"\u00A0"}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View entering={FadeInRight.springify()} style={styles.block}>
          <Text style={styles.label}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nom d’article ou produit"
            placeholderTextColor={c.textMuted}
            style={styles.input}
          />
          <View style={styles.twoCol}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.label}>Prix</Text>
              <View style={styles.priceBox}>
                <TextInput
                  value={price}
                  onChangeText={(value) => setPrice(sanitizePriceInput(value))}
                  keyboardType="decimal-pad"
                  placeholder="25.50"
                  placeholderTextColor={c.textMuted}
                  style={[styles.input, styles.priceInput]}
                />
                <View style={styles.currencies}>
                  {APP_CURRENCIES.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => {
                        if (item === currency) return;
                        setCurrency(item);
                        setPrice("");
                      }}
                      style={[
                        styles.curChip,
                        currency === item && styles.chipOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          currency === item && styles.chipTextOn,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ width: 88, gap: 8 }}>
              <Text style={styles.label}>Qté</Text>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.catGrid}>
            {categories.map((item) => {
              const look = categoryLooks[item];
              const on = category === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.cat, on && styles.catOn]}
                >
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: look.colors[0] },
                    ]}
                  >
                    <Ionicons name={look.icon} size={18} color="#fff" />
                  </View>
                  <Text style={styles.catText}>{item}</Text>
                  {on ? <View style={styles.catDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setOptionsOpen((value) => !value)}
            style={[
              styles.more,
              (pickedColors.length > 0 || pickedSizes.length > 0) &&
                styles.moreOn,
            ]}
          >
            <View style={styles.moreIcon}>
              <Ionicons name="color-palette" size={18} color="#FFB067" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTitle}>
                Plus d’options
                {pickedColors.length + pickedSizes.length > 0
                  ? ` · ${pickedColors.length + pickedSizes.length}`
                  : ""}
              </Text>
              <Text style={styles.moreSub}>Couleurs, tailles, description</Text>
            </View>
            <Ionicons
              name={optionsOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={c.textMuted}
            />
          </Pressable>

          {optionsOpen ? (
            <View style={styles.options}>
              <Text style={styles.label}>Couleurs</Text>
              <View style={styles.rowWrap}>
                {PRESET_COLORS.map((item) => {
                  const on = pickedColors.includes(item.name);
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() =>
                        toggle(pickedColors, item.name, setPickedColors)
                      }
                      style={[styles.swatchWrap, on && styles.swatchWrapOn]}
                    >
                      <View
                        style={[styles.swatch, { backgroundColor: item.hex }]}
                      />
                      <Text style={styles.swatchName}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.label}>Tailles vêtements</Text>
              <View style={styles.rowWrap}>
                {CLOTHING_SIZES.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => toggle(pickedSizes, item, setPickedSizes)}
                    style={[
                      styles.chip,
                      pickedSizes.includes(item) && styles.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        pickedSizes.includes(item) && styles.chipTextOn,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Pointures</Text>
              <View style={styles.rowWrap}>
                {SHOE_SIZES.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => toggle(pickedSizes, item, setPickedSizes)}
                    style={[
                      styles.chip,
                      pickedSizes.includes(item) && styles.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        pickedSizes.includes(item) && styles.chipTextOn,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Confort, style et élégance"
                placeholderTextColor={c.textMuted}
                style={[styles.input, styles.area]}
                multiline
              />
              <Text style={styles.location}>
                Localisation boutique · Kinshasa
              </Text>
            </View>
          ) : null}

          <View style={styles.navRow}>
            <Pressable style={styles.ghostCta} onPress={() => setStep(1)}>
              <Text style={styles.ghostCtaText} numberOfLines={1}>
                Retour{"\u00A0"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.cta,
                styles.ctaFlex,
                (!price || title.trim().length < 2) && { opacity: 0.5 },
              ]}
              disabled={!price || title.trim().length < 2}
              onPress={() => setStep(3)}
            >
              <Text style={styles.ctaText} numberOfLines={1}>
                Suivant{"\u00A0"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {step === 3 ? (
        <Animated.View entering={FadeInRight.springify()} style={styles.block}>
          <View style={styles.preview}>
            <Text style={styles.previewShop}>{shop?.name}</Text>
            <Text style={styles.previewTitle}>
              {title.trim() || "Sans titre"}
            </Text>
            <Text style={styles.previewPrice}>
              {formatMoney(priceToCents(price), currency)} · stock {quantity}
            </Text>
            <Text style={styles.previewMeta}>
              {category} · Kinshasa · {images.length} média
              {images.length > 1 ? "s" : ""}
              {soundtrackId ? " · son" : ""}
            </Text>
            {pickedColors.length > 0 ? (
              <View style={styles.rowWrap}>
                {pickedColors.map((name) => {
                  const hex =
                    PRESET_COLORS.find((item) => item.name === name)?.hex ??
                    "#888";
                  return (
                    <View
                      key={name}
                      style={[styles.previewDot, { backgroundColor: hex }]}
                    />
                  );
                })}
              </View>
            ) : null}
            {pickedSizes.length > 0 ? (
              <Text style={styles.previewMeta}>
                Tailles : {pickedSizes.join(", ")}
              </Text>
            ) : null}
            {description.trim() ? (
              <Text style={styles.previewDesc}>{description.trim()}</Text>
            ) : null}
          </View>
          <View style={styles.escrow}>
            <Text style={styles.escrowText}>
              Tu vends en vidéo. L’argent de l’acheteur est bloqué jusqu’à la
              réception.
            </Text>
          </View>
          <View style={styles.navRow}>
            <Pressable style={styles.ghostCta} onPress={() => setStep(2)}>
              <Text style={styles.ghostCtaText} numberOfLines={1}>
                Retour{"\u00A0"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.ghostCta,
                styles.ctaFlex,
                busy && { opacity: 0.6 },
              ]}
              disabled={busy}
              onPress={() => void save("DRAFT")}
            >
              <Text style={styles.ghostCtaText} numberOfLines={1}>
                Brouillon
              </Text>
            </Pressable>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => void save("ACTIVE")}
            style={busy ? { opacity: 0.6 } : undefined}
          >
            <View style={[styles.publish, { backgroundColor: c.primary }]}>
              <Text style={styles.publishText}>
                {busy ? "Publication…" : "Publier maintenant"}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

function makeSellStyles(c: ThemeColors = colors) {
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
    bars: { flexDirection: "row", gap: 6 },
    bar: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: HAIRLINE,
    },
    barDone: { backgroundColor: c.primary },
    barNow: { backgroundColor: c.primary },
    kicker: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    title: { color: c.text, fontSize: 26, fontWeight: "800" },
    block: { gap: 10 },
    label: { color: c.textMuted, fontWeight: "700", fontSize: 12 },
    input: {
      backgroundColor: c.card,
      borderRadius: 14,
      color: c.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    area: { minHeight: 90, textAlignVertical: "top" },
    twoCol: { flexDirection: "row", gap: 10 },
    priceBox: { gap: 8 },
    priceInput: { fontSize: 18, fontWeight: "800" },
    currencies: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    curChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.text, fontWeight: "800", fontSize: 12 },
    chipTextOn: { color: c.primaryForeground },
    catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    cat: {
      width: "48%",
      flexGrow: 1,
      flexBasis: "46%",
      borderRadius: 18,
      padding: 12,
      gap: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    catOn: {
      borderColor: `${c.primary}88`,
      backgroundColor: `${c.primary}22`,
    },
    catIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    catText: { color: c.text, fontWeight: "800", fontSize: 13 },
    catDot: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    more: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      padding: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    moreOn: {
      borderColor: `${c.primary}66`,
      backgroundColor: `${c.primary}14`,
    },
    moreIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: `${c.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    moreTitle: { color: c.text, fontWeight: "800" },
    moreSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    options: { gap: 10 },
    swatchWrap: {
      width: 72,
      alignItems: "center",
      gap: 6,
      padding: 8,
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: "transparent",
    },
    swatchWrapOn: {
      borderColor: c.primary,
      backgroundColor: `${c.primary}22`,
    },
    swatch: { width: 28, height: 28, borderRadius: 14 },
    swatchName: { color: c.text, fontSize: 10, fontWeight: "700" },
    location: { color: c.textMuted, fontSize: 12 },
    preview: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 16,
      gap: 6,
    },
    previewShop: { color: c.emerald, fontWeight: "700", fontSize: 12 },
    previewTitle: { color: c.text, fontWeight: "800", fontSize: 20 },
    previewPrice: { color: c.emerald, fontWeight: "800", fontSize: 22 },
    previewMeta: { color: c.textMuted },
    previewDesc: { color: c.text, marginTop: 4 },
    previewDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    escrow: {
      borderRadius: 14,
      padding: 12,
      backgroundColor: `${c.emerald}22`,
      borderWidth: 1,
      borderColor: `${c.emerald}44`,
    },
    escrowText: { color: c.emerald, fontSize: 12, lineHeight: 18 },
    navRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    cta: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 22,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    ctaFlex: { flex: 1, minWidth: 120 },
    ctaText: {
      color: c.primaryForeground,
      fontWeight: "800",
      flexShrink: 0,
      includeFontPadding: false,
      paddingHorizontal: 6,
    },
    ghostCta: {
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 110,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: HAIRLINE,
      overflow: "visible",
    },
    ghostCtaText: {
      color: c.text,
      fontWeight: "800",
      flexShrink: 0,
      includeFontPadding: false,
      paddingHorizontal: 6,
    },
    publish: {
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
    },
    publishText: {
      color: c.primaryForeground,
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
