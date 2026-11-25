import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/src/api";
import type { AvatarSource, WearMode } from "@/src/avatars";
import {
    AUDIENCE_CHIPS,
    CREATE_AI_ACCENT,
    CREATE_AI_BG,
    CREATE_AI_SURFACE,
    FILTER_CATEGORIES,
    MAKEUP_PROMPTS_SURPRISE,
    MAKEUP_STYLES,
    MODE_STYLE_STRIP,
    PRODUCT_LOOK_STYLES,
    mannequinsForAudience,
    type AudienceId,
    type FilterCategoryId,
    type MakeupStyleId,
    type MannequinId,
    type ProductFilterSelection,
    type ProductLookStyle,
    type ProductLookStyleId,
} from "@/src/product-filters";
import { useTabBarMetrics } from "@/src/tab-bar-metrics";
import { showToast } from "@/src/toast";
import { createClientPreviewTryOn } from "@/src/tryon-types";
import { computeTryOnLayout, type TryOnLayout } from "@/src/virtual-try-on";

// Essayage : mannequin nu → Essayer porte l’article → Valider
/** Article sélectionné + teinte claire appliquée en temps réel. */
function FilteredArticleImage({
  uri,
  look,
  style,
  contentFit = "cover",
}: {
  uri: string;
  look: ProductLookStyle;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
}) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#151518" }, style]}>
      <Image
        source={{ uri }}
        style={[
          StyleSheet.absoluteFill,
          look.grayscale ? { opacity: 0.92 } : null,
        ]}
        contentFit={contentFit}
      />
      {look.lift ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: look.lift }]}
        />
      ) : null}
      {look.gradient && look.gradient.colors.length >= 2 ? (
        <LinearGradient
          pointerEvents="none"
          colors={look.gradient.colors as [string, string, ...string[]]}
          start={look.gradient.start ?? { x: 0.5, y: 0 }}
          end={look.gradient.end ?? { x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {look.overlays.map((color, i) => (
        <View
          key={`${look.id}-${i}`}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
        />
      ))}
      {look.grayscale ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(255,255,255,0.04)" },
          ]}
        />
      ) : null}
    </View>
  );
}

/**
 * Habit = référence visuelle.
 * Le mannequin est placé dessous pour coincider avec le cadre habit.
 */
function GarmentHero({
  productUri,
  frame,
  garmentFit,
}: {
  productUri: string;
  frame: TryOnLayout["garmentFrame"];
  garmentFit: TryOnLayout["garmentFit"];
  wearMode: WearMode;
}) {
  const isFlat = garmentFit === "contain";
  // Multiply : le volume du mannequin (dessous) apparaît dans le tissu
  const blendStyle =
    Platform.OS === "web"
      ? ({ mixBlendMode: "multiply" } as ViewStyle)
      : undefined;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.garmentAnchor,
        {
          left: `${frame.x * 100}%`,
          top: `${frame.y * 100}%`,
          width: `${frame.width * 100}%`,
          height: `${frame.height * 100}%`,
          overflow: "hidden",
          opacity: Platform.OS === "web" ? 1 : 0.88,
        },
        blendStyle,
      ]}
    >
      <Image
        source={{ uri: productUri }}
        style={[
          StyleSheet.absoluteFill,
          isFlat ? { transform: [{ scale: 1.45 }, { translateY: 28 }] } : null,
        ]}
        contentFit="cover"
        contentPosition={isFlat ? { top: "32%", left: "50%" } : "center"}
      />
    </View>
  );
}

/** Mannequin seul → Essayer : habit fixe, mannequin aligné dessus. */
function TryOnStage({
  mannequinSource,
  productUri,
  look,
  wearGarment,
  layout,
  fitting,
  wearMode,
}: {
  mannequinSource: AvatarSource;
  productUri: string;
  look: ProductLookStyle;
  wearGarment: boolean;
  layout: TryOnLayout;
  fitting: boolean;
  darkMannequin: boolean;
  wearMode: WearMode;
  mannequinId: string;
}) {
  const showGarment = wearGarment && layout.canWear && !fitting;
  const fit = layout.mannequinFit;

  return (
    <View style={styles.tryOnRoot}>
      {/* Mannequin : plein cadre si nu ; sinon suit le cadre de l’habit */}
      <Image
        source={mannequinSource}
        style={
          showGarment
            ? {
                position: "absolute",
                left: `${fit.x * 100}%`,
                top: `${fit.y * 100}%`,
                width: `${fit.width * 100}%`,
                height: `${fit.height * 100}%`,
              }
            : StyleSheet.absoluteFill
        }
        // contain : bras A-pose visibles pour s’aligner sur les manches
        contentFit="contain"
        contentPosition="center"
      />
      {showGarment ? (
        <GarmentHero
          productUri={productUri}
          frame={layout.garmentFrame}
          garmentFit={layout.garmentFit}
          wearMode={wearMode}
        />
      ) : null}
      {showGarment && look.lift ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: look.lift }]}
        />
      ) : null}
      {showGarment && look.gradient && look.gradient.colors.length >= 2 ? (
        <LinearGradient
          pointerEvents="none"
          colors={look.gradient.colors as [string, string, ...string[]]}
          start={look.gradient.start ?? { x: 0.5, y: 0 }}
          end={look.gradient.end ?? { x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {showGarment
        ? look.overlays.map((color, i) => (
            <View
              key={`tryon-${look.id}-${i}`}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
            />
          ))
        : null}
      {!wearGarment && !fitting ? (
        <View style={styles.bareHint} pointerEvents="none">
          <Ionicons name="shirt-outline" size={16} color="#FFFFFF" />
          <Text style={styles.bareHintText}>
            Essayer · le mannequin s’aligne sur l’habit
          </Text>
        </View>
      ) : null}
      {fitting ? (
        <View style={styles.fittingOverlay} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.fittingText}>
            Alignement mannequin sur {layout.garment.label.toLowerCase()}…
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MannequinThumbTryOn({
  mannequinSource,
  selected,
}: {
  mannequinSource: AvatarSource;
  selected: boolean;
}) {
  return (
    <View style={[styles.mannequinHit, selected && styles.mannequinOn]}>
      <Image
        source={mannequinSource}
        style={styles.mannequinImg}
        contentFit="cover"
      />
      {selected ? (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  productImageUrl: string;
  productTitle?: string;
  productCategory?: string;
  onClose: () => void;
  onApply?: (selection: ProductFilterSelection) => void;
  onNewVideo?: () => void;
};

export function ProductFiltersScreen({
  productImageUrl,
  productTitle = "T-shirt Oversize",
  productCategory,
  onClose,
  onApply,
  onNewVideo,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarMetrics();
  const productUri = mediaUrl(productImageUrl) ?? productImageUrl;
  /** Padding bas pour scroller tout le contenu au-dessus de la tab bar. */
  const scrollBottomPad = Math.max(insets.bottom, 8) + tabBar.barBody + 24;

  const [category, setCategory] = useState<FilterCategoryId>("mode");
  const [audience, setAudience] = useState<AudienceId>("homme");
  const [mannequinId, setMannequinId] = useState<MannequinId>("m-homme-1");
  /** false = mannequin seul ; true = porte l’article sélectionné */
  const [wearGarment, setWearGarment] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [lookStyleId, setLookStyleId] = useState<ProductLookStyleId>("studio");
  const [makeupStyleId, setMakeupStyleId] = useState<MakeupStyleId>("smokey");
  const [prompt, setPrompt] = useState(MAKEUP_STYLES[2]!.prompt);
  const [arEnabled, setArEnabled] = useState(true);
  const [styleStripId, setStyleStripId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    RNImage.getSize(
      productUri,
      (w, h) => {
        if (!cancelled && h > 0) setImageRatio(w / h);
      },
      () => {
        if (!cancelled) setImageRatio(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [productUri]);

  const activeLook = useMemo(
    () =>
      PRODUCT_LOOK_STYLES.find((s) => s.id === lookStyleId) ??
      PRODUCT_LOOK_STYLES[0]!,
    [lookStyleId],
  );

  const audienceMannequins = useMemo(
    () => mannequinsForAudience(audience),
    [audience],
  );

  const activeMannequin = useMemo(() => {
    const match = audienceMannequins.find((m) => m.id === mannequinId);
    return match ?? audienceMannequins[0] ?? null;
  }, [audienceMannequins, mannequinId]);

  /** Mannequins retirés : l’image produit d’origine reste au centre. */
  const tryOnActive = false;

  const tryOnLayout = useMemo(() => {
    if (!activeMannequin) return null;
    const mannequinAudience =
      audience === "tous" || audience === "jeune" || audience === "adulte"
        ? activeMannequin.audience
        : audience;
    return computeTryOnLayout({
      title: productTitle,
      category: productCategory,
      imageRatio,
      audience: mannequinAudience,
      shot: activeMannequin.shot,
      frame: activeMannequin.frame,
      bodyProfile: activeMannequin.bodyProfile,
    });
  }, [activeMannequin, audience, productTitle, productCategory, imageRatio]);

  function commitSelection(
    patch: Partial<ProductFilterSelection>,
    toastMsg: string,
  ) {
    const selection: ProductFilterSelection = {
      category,
      audience,
      mannequinId: activeMannequin?.id ?? mannequinId,
      lookStyleId,
      makeupStyleId,
      prompt,
      arEnabled,
      styleStripId,
      ...patch,
    };
    onApply?.(selection);
    showToast(toastMsg, "success");
  }

  function selectAudience(next: AudienceId) {
    setAudience(next);
    const list = mannequinsForAudience(next);
    const nextMannequinId = list[0]?.id ?? mannequinId;
    if (list[0]) {
      setMannequinId(list[0].id);
    }
    setWearGarment(false);
    setFitting(false);
    const label = AUDIENCE_CHIPS.find((c) => c.id === next)?.label ?? next;
    commitSelection(
      { audience: next, mannequinId: nextMannequinId },
      `Filtre « ${label} » appliqué`,
    );
  }

  function selectMannequin(id: MannequinId) {
    setMannequinId(id);
    setFitting(false);
  }

  function selectLook(id: ProductLookStyleId) {
    setLookStyleId(id);
    const label = PRODUCT_LOOK_STYLES.find((s) => s.id === id)?.label ?? id;
    commitSelection({ lookStyleId: id }, `Filtre « ${label} » appliqué`);
  }

  function selectStrip(id: string) {
    setStyleStripId(id);
    commitSelection({ styleStripId: id }, "Filtre appliqué");
  }

  function selectMakeup(style: (typeof MAKEUP_STYLES)[number]) {
    setMakeupStyleId(style.id);
    setPrompt(style.prompt);
    commitSelection(
      { makeupStyleId: style.id, prompt: style.prompt },
      `Makeup « ${style.label} » appliqué`,
    );
  }

  function surpriseMe() {
    const next =
      MAKEUP_PROMPTS_SURPRISE[
        Math.floor(Math.random() * MAKEUP_PROMPTS_SURPRISE.length)
      ]!;
    setPrompt(next);
    const match = MAKEUP_STYLES.find((s) =>
      s.prompt.startsWith(next.slice(0, 12)),
    );
    if (match) setMakeupStyleId(match.id);
  }

  /** Porter l’article sélectionné sur le mannequin (reste sur l’écran). */
  function wearSelectedArticle() {
    if (!tryOnActive || !tryOnLayout || !activeMannequin) return;
    if (!tryOnLayout.canWear) {
      showToast("Choisis un mannequin corps entier", "info");
      return;
    }
    if (wearGarment) {
      // Déjà porté → valider et fermer
      apply();
      return;
    }
    setFitting(true);
    setTimeout(() => {
      const session = createClientPreviewTryOn({
        request: {
          avatarId: activeMannequin.id,
          provider: "client-preview",
          garmentPhotoType: tryOnLayout.garment.photoType,
          category: productCategory ?? "mode",
          garmentImageUrl: productUri,
          garmentTitle: productTitle,
        },
        audience:
          audience === "tous" || audience === "jeune" || audience === "adulte"
            ? activeMannequin.audience
            : audience,
        shot: activeMannequin.shot,
        frame: activeMannequin.frame,
        bodyProfile: activeMannequin.bodyProfile,
        imageRatio,
      });
      setWearGarment(true);
      setFitting(false);
      showToast(
        session.status === "completed"
          ? `${tryOnLayout.garment.label} portée · ${activeMannequin.label}`
          : "Essayage en cours…",
        "success",
      );
    }, 700);
  }

  function removeGarment() {
    setWearGarment(false);
    setFitting(false);
  }

  function apply() {
    commitSelection(
      {},
      category === "beaute"
        ? `Makeup « ${MAKEUP_STYLES.find((s) => s.id === makeupStyleId)?.label} » prêt`
        : `Filtre « ${activeLook.label} » sur l’article`,
    );
    onClose();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          style={styles.iconHit}
          accessibilityLabel="Fermer"
          hitSlop={8}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Filtres produits</Text>
        <Pressable
          onPress={() => {
            onNewVideo?.();
            showToast("Capture vidéo depuis la caméra", "info");
          }}
          style={styles.newVideoBtn}
          accessibilityLabel="Nouvelle vidéo"
        >
          <Ionicons name="videocam-outline" size={14} color="#FFFFFF" />
          <Text style={styles.newVideoText}>+ Nouvelle vidéo</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catRow}
      >
        {FILTER_CATEGORIES.map((item) => {
          const on = item.id === category;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setCategory(item.id);
                commitSelection(
                  { category: item.id },
                  `Filtre « ${item.label} » appliqué`,
                );
              }}
              style={styles.catItem}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View
                style={[
                  styles.catIcon,
                  on && {
                    backgroundColor: CREATE_AI_ACCENT,
                    borderColor: CREATE_AI_ACCENT,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={on ? "#FFFFFF" : "rgba(255,255,255,0.75)"}
                />
              </View>
              <Text style={[styles.catLabel, on && styles.catLabelOn]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.catItem} accessibilityLabel="Rechercher">
          <View style={styles.catIcon}>
            <Ionicons name="search" size={22} color="rgba(255,255,255,0.75)" />
          </View>
        </Pressable>
      </ScrollView>

      {category === "mode" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {AUDIENCE_CHIPS.map((chip) => {
            const on = chip.id === audience;
            return (
              <Pressable
                key={chip.id}
                onPress={() => selectAudience(chip.id)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingBottom: scrollBottomPad,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {category === "beaute" ? (
          <MakeupPanel
            productUri={productUri}
            prompt={prompt}
            onPrompt={setPrompt}
            makeupStyleId={makeupStyleId}
            onSelectStyle={selectMakeup}
            onSurprise={surpriseMe}
            onTry={apply}
          />
        ) : (
          <>
            <View style={styles.heroCard}>
              {tryOnActive && activeMannequin && tryOnLayout ? (
                <TryOnStage
                  mannequinSource={activeMannequin.source}
                  productUri={productUri}
                  look={activeLook}
                  wearGarment={wearGarment}
                  layout={tryOnLayout}
                  fitting={fitting}
                  darkMannequin={activeMannequin.dark}
                  wearMode={activeMannequin.wearMode}
                  mannequinId={activeMannequin.id}
                />
              ) : (
                <FilteredArticleImage
                  uri={productUri}
                  look={activeLook}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                />
              )}
              <View style={styles.heroScrim} pointerEvents="none" />

              <View style={styles.productBar}>
                <Image
                  source={{ uri: productUri }}
                  style={styles.productThumb}
                  contentFit="cover"
                />
                <View style={styles.productMeta}>
                  <Text style={styles.productTitle} numberOfLines={1}>
                    Article sélectionné
                  </Text>
                  <Text style={styles.productSub} numberOfLines={1}>
                    {`${productTitle} · ${activeLook.label}`}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#FFD60A" />
                    <Text style={styles.ratingText}>4.8 (12k)</Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.mannequinRail}
                contentContainerStyle={styles.mannequinRailInner}
                showsVerticalScrollIndicator={false}
              >
                {tryOnActive && tryOnLayout
                  ? audienceMannequins.map((m) => {
                      const on = m.id === activeMannequin?.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => selectMannequin(m.id)}
                          accessibilityLabel={`Mannequin ${m.label}`}
                          accessibilityState={{ selected: on }}
                        >
                          <MannequinThumbTryOn
                            mannequinSource={m.source}
                            selected={on}
                          />
                        </Pressable>
                      );
                    })
                  : PRODUCT_LOOK_STYLES.map((look) => {
                      const on = look.id === lookStyleId;
                      return (
                        <Pressable
                          key={look.id}
                          onPress={() => selectLook(look.id)}
                          style={[
                            styles.mannequinHit,
                            on && styles.mannequinOn,
                          ]}
                          accessibilityLabel={`Style ${look.label}`}
                          accessibilityState={{ selected: on }}
                        >
                          <FilteredArticleImage
                            uri={productUri}
                            look={look}
                            style={styles.mannequinImg}
                          />
                          {on ? (
                            <View style={styles.checkBadge}>
                              <Ionicons
                                name="checkmark"
                                size={10}
                                color="#fff"
                              />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                <Pressable
                  style={styles.chooseOther}
                  onPress={() => showToast("Plus de styles bientôt", "info")}
                >
                  <Text style={styles.chooseOtherText}>
                    +{"\n"}Choisir un{"\n"}autre style
                  </Text>
                </Pressable>
              </ScrollView>

              <View style={styles.arPill}>
                <Ionicons name="cube-outline" size={16} color="#FFFFFF" />
                <Text style={styles.arText}>Voir en réalité augmentée</Text>
                <Switch
                  value={arEnabled}
                  onValueChange={setArEnabled}
                  trackColor={{
                    false: "rgba(255,255,255,0.25)",
                    true: CREATE_AI_ACCENT,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.lookScroll}
              contentContainerStyle={styles.lookRow}
            >
              {PRODUCT_LOOK_STYLES.map((look) => {
                const on = look.id === lookStyleId;
                return (
                  <Pressable
                    key={look.id}
                    onPress={() => selectLook(look.id)}
                    style={[styles.lookChip, on && styles.lookChipOn]}
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      style={[styles.lookChipText, on && styles.lookChipTextOn]}
                    >
                      {look.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.stripHeader}>
              <Text style={styles.stripTitle}>
                Autres filtres{" "}
                {FILTER_CATEGORIES.find(
                  (c) => c.id === category,
                )?.label.toLowerCase()}
              </Text>
              <Pressable
                onPress={() => showToast("Galerie complète bientôt", "info")}
                hitSlop={8}
              >
                <Text style={styles.seeAll}>Voir tous →</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stripRow}
            >
              {MODE_STYLE_STRIP.map((item) => {
                const on = styleStripId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => selectStrip(item.id)}
                    style={[styles.stripItem, on && styles.stripItemOn]}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={styles.stripImg}
                      contentFit="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const MAKEUP_LOOK_MAP: Record<MakeupStyleId, ProductLookStyleId> = {
  natural: "doux",
  glam: "vivid",
  smokey: "urbain",
  dewy: "studio",
};

function MakeupPanel({
  productUri,
  prompt,
  onPrompt,
  makeupStyleId,
  onSelectStyle,
  onSurprise,
  onTry,
}: {
  productUri: string;
  prompt: string;
  onPrompt: (v: string) => void;
  makeupStyleId: MakeupStyleId;
  onSelectStyle: (style: (typeof MAKEUP_STYLES)[number]) => void;
  onSurprise: () => void;
  onTry: () => void;
}) {
  const look =
    PRODUCT_LOOK_STYLES.find((s) => s.id === MAKEUP_LOOK_MAP[makeupStyleId]) ??
    PRODUCT_LOOK_STYLES[0]!;

  return (
    <View style={styles.makeupRoot}>
      <View style={styles.makeupHeader}>
        <Ionicons name="diamond-outline" size={22} color="#FFFFFF" />
        <Text style={styles.makeupTitle}>Makeup</Text>
        <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
      </View>

      <View style={styles.makeupHero}>
        <FilteredArticleImage
          uri={productUri}
          look={look}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      </View>

      <View style={styles.promptBox}>
        <TextInput
          value={prompt}
          onChangeText={onPrompt}
          multiline
          style={styles.promptInput}
          placeholderTextColor="rgba(255,255,255,0.4)"
          placeholder="Décris le rendu makeup…"
        />
      </View>

      <Pressable onPress={onSurprise} style={styles.surpriseBtn}>
        <Text style={styles.surpriseText}>💡 Suprise Me!</Text>
      </Pressable>

      <Text style={styles.styleLabel}>Style</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.makeupStyles}
      >
        {MAKEUP_STYLES.map((style) => {
          const on = style.id === makeupStyleId;
          return (
            <Pressable
              key={style.id}
              onPress={() => onSelectStyle(style)}
              style={styles.makeupStyleItem}
            >
              <View
                style={[styles.makeupStyleThumb, on && styles.makeupStyleOn]}
              >
                <Image
                  source={{ uri: style.image }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </View>
              <Text style={styles.makeupStyleLabel}>{style.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.tryNow} onPress={onTry}>
        <Text style={styles.tryNowText}>Try It Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREATE_AI_BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    minHeight: 48,
    gap: 4,
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  newVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: CREATE_AI_SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
  },
  newVideoText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  catScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 90 },
  catRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 14,
    alignItems: "flex-start",
    flexDirection: "row",
  },
  catItem: { alignItems: "center", width: 64, gap: 6 },
  catIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: CREATE_AI_SURFACE,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "600",
  },
  catLabelOn: { color: "#FFFFFF" },
  chipScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 52 },
  chipRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    alignItems: "center",
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CREATE_AI_SURFACE,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  chipOn: { backgroundColor: CREATE_AI_ACCENT },
  chipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextOn: { color: "#FFFFFF" },
  body: { flex: 1 },
  heroCard: {
    height: 420,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: CREATE_AI_SURFACE,
  },
  tryOnRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFFFFF",
  },
  garmentAnchor: {
    position: "absolute",
    overflow: "visible",
  },
  garmentClip: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  garmentShirtShape: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginHorizontal: "4%",
  },
  garmentDressShape: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginHorizontal: "3%",
  },
  garmentSoftShape: {
    borderRadius: 20,
    marginHorizontal: "4%",
  },
  garmentImg: {
    width: "100%",
    height: "100%",
  },
  neckHole: {
    position: "absolute",
    zIndex: 2,
    alignSelf: "center",
    top: -2,
    width: "34%",
    height: 16,
    marginLeft: "33%",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: "#FFFFFF",
  },
  fittingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  fittingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  detectBadge: {
    position: "absolute",
    left: 12,
    top: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(138,92,245,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detectBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  detectRemove: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginLeft: 4,
  },
  bareHint: {
    position: "absolute",
    left: 12,
    right: 72,
    bottom: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(20,20,24,0.78)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bareHintText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  essayerBtnBusy: { opacity: 0.7 },
  chooseOther: {
    width: 48,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "rgba(20,20,24,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  chooseOtherText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 11,
  },
  lookScroll: { flexGrow: 0, marginTop: 12 },
  lookRow: {
    gap: 8,
    paddingVertical: 2,
    alignItems: "center",
    flexDirection: "row",
  },
  lookChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CREATE_AI_SURFACE,
    minHeight: 36,
    justifyContent: "center",
  },
  lookChipOn: { backgroundColor: CREATE_AI_ACCENT },
  lookChipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  lookChipTextOn: { color: "#FFFFFF" },
  heroScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  productBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(20,20,24,0.72)",
    borderRadius: 16,
    padding: 8,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  productMeta: { flex: 1, minWidth: 0 },
  productTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  productSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  essayerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: CREATE_AI_ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 40,
  },
  essayerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  mannequinRail: {
    position: "absolute",
    top: 88,
    right: 10,
    bottom: 64,
    width: 56,
  },
  mannequinRailInner: {
    gap: 8,
    alignItems: "center",
    paddingBottom: 8,
  },
  mannequinHit: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  mannequinOn: { borderColor: CREATE_AI_ACCENT },
  mannequinImg: { width: "100%", height: "100%" },
  shotBadge: {
    position: "absolute",
    left: 2,
    top: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(20,20,24,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  shotBadgeAvatar: { backgroundColor: CREATE_AI_ACCENT },
  shotBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },
  checkBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: CREATE_AI_ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  arPill: {
    position: "absolute",
    left: 12,
    bottom: 12,
    right: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(20,20,24,0.78)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  arText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  stripHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 12,
  },
  stripTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  seeAll: {
    color: CREATE_AI_ACCENT,
    fontSize: 13,
    fontWeight: "600",
  },
  stripRow: { gap: 10, paddingBottom: 8 },
  stripItem: {
    width: 96,
    height: 132,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  stripItemOn: { borderColor: CREATE_AI_ACCENT },
  stripImg: { width: "100%", height: "100%" },

  makeupRoot: { gap: 14 },
  makeupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  makeupTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  makeupHero: {
    height: 320,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: CREATE_AI_SURFACE,
  },
  makeupProductInset: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 14,
    right: 14,
    bottom: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  promptBox: {
    backgroundColor: CREATE_AI_SURFACE,
    borderRadius: 16,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptInput: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 48,
    textAlignVertical: "top",
  },
  surpriseBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  surpriseText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  styleLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  makeupStyles: { gap: 14, paddingVertical: 4 },
  makeupStyleItem: { width: 84, alignItems: "center", gap: 8 },
  makeupStyleThumb: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  makeupStyleOn: { borderColor: CREATE_AI_ACCENT },
  makeupStyleLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  tryNow: {
    marginTop: 8,
    backgroundColor: CREATE_AI_SURFACE,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  tryNowText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
