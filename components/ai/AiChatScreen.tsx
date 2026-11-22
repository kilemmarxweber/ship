import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { safeBack } from "@/src/nav";
import { useSession } from "@/src/session";

type ProductCard = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  images?: string[];
};

type AssistLink = {
  id: string;
  kind:
    | "product"
    | "shop"
    | "live"
    | "event"
    | "challenge"
    | "order"
    | "wanted"
    | "route";
  title: string;
  subtitle?: string | null;
  href: string;
  imageUrl?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: ProductCard[];
  links?: AssistLink[];
};

const ROBOT = require("@/assets/images/maquette/ia-robot.png");
const ICON_PHONE = require("@/assets/images/maquette/ia-icon-0.png");
const ICON_DRESS = require("@/assets/images/maquette/ia-icon-1.png");
const ICON_SEARCH = require("@/assets/images/maquette/ia-icon-2.png");

/** Cards maquette : icônes + libellés exacts. */
const SUGGESTIONS = [
  {
    icon: ICON_PHONE,
    label: "Quel est le meilleur smartphone ?",
    lines: ["Quel est le meilleur", "smartphone ?"],
    glow: "rgba(255,90,31,0.22)" as const,
  },
  {
    icon: ICON_DRESS,
    label: "Montre-moi des robes élégantes",
    lines: ["Montre-moi des robes", "élégantes"],
    glow: "rgba(168,85,247,0.22)" as const,
  },
  {
    icon: ICON_SEARCH,
    label: "Aide-moi à trouver un produit",
    lines: ["Aide-moi à trouver", "un produit"],
    glow: "rgba(34,211,238,0.20)" as const,
  },
];

const BG = "#05080D";
const SURFACE = "#12161F";
const ORANGE = "#FF5A1F";
const TEXT = "#F5F7FA";
const MUTED = "#9AA3B5";
const BORDER = "rgba(255,255,255,0.08)";

function linkIcon(kind: AssistLink["kind"]): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "shop":
      return "storefront-outline";
    case "live":
      return "radio-outline";
    case "event":
      return "ticket-outline";
    case "challenge":
      return "trophy-outline";
    case "order":
      return "receipt-outline";
    case "wanted":
      return "search-outline";
    case "route":
      return "compass-outline";
    default:
      return "pricetag-outline";
  }
}

export function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const token = useSession((s) => s.token);
  const openAuth = useSession((s) => s.openAuth);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const empty = messages.length === 0;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!token) {
      openAuth();
      return;
    }
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text: trimmed },
    ]);
    setBusy(true);
    try {
      const data = await api<{
        reply?: string;
        products?: ProductCard[];
        links?: AssistLink[];
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text:
            data.reply ??
            "Je n’ai pas trouvé de réponse. Reformulez ou ouvrez Découvrir.",
          products: data.products ?? [],
          links: data.links ?? [],
        },
      ]);
    } catch (cause) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          text:
            cause instanceof Error
              ? cause.message
              : "Assistant indisponible. Réessayez plus tard.",
        },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => safeBack("/(tabs)" as Href)}
          hitSlop={10}
          style={styles.iconHit}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.title}>IA Chat</Text>
        <Pressable
          onPress={() => router.push("/profile" as Href)}
          hitSlop={10}
          style={styles.iconHit}
          accessibilityLabel="Réglages"
        >
          <Ionicons name="settings-outline" size={22} color={MUTED} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={empty ? [] : messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, empty && styles.listEmpty]}
        onContentSizeChange={() => {
          if (!empty) listRef.current?.scrollToEnd({ animated: true });
        }}
        ListHeaderComponent={
          empty ? (
            <View style={styles.emptyHero} testID="ai-chat-empty">
              <View style={styles.robotWrap}>
                <Image
                  source={ROBOT}
                  style={styles.robot}
                  contentFit="contain"
                  accessibilityLabel="Assistant ShipShop"
                />
              </View>

              <View style={styles.welcomeBlock}>
                <Text style={styles.welcomeHi}>Bonjour !</Text>
                <Text style={styles.welcomeLead}>Je suis votre assistant</Text>
                <Text style={styles.welcomeBrand}>ShipShop 🤖</Text>
                <Text style={styles.welcomeSub}>
                  Posez-moi une question, trouvez un produit{"\n"}ou demandez
                  conseil.
                </Text>
              </View>

              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={() => void send(s.label)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.suggestionPress,
                      pressed && {
                        opacity: 0.88,
                        transform: [{ scale: 0.985 }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.07)",
                        "rgba(18,22,31,0.95)",
                        "rgba(12,15,22,0.98)",
                      ]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={[styles.suggestion, { shadowColor: s.glow }]}
                    >
                      <View
                        style={[
                          styles.suggestionIconGlow,
                          { backgroundColor: s.glow },
                        ]}
                      >
                        <Image
                          source={s.icon}
                          style={styles.suggestionIcon}
                          contentFit="contain"
                        />
                      </View>
                      <Text style={styles.suggestionText}>
                        {s.lines[0]}
                        {"\n"}
                        {s.lines[1]}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ height: 8 }} />
          )
        }
        renderItem={({ item }) => {
          const products = item.products ?? [];
          const extraLinks =
            item.links?.filter((link) => link.kind !== "product") ?? [];
          return (
            <View style={styles.messageBlock}>
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: item.role === "user" ? "#fff" : TEXT },
                  ]}
                >
                  {item.text}
                </Text>
              </View>

              {products.length > 0 ? (
                <View style={styles.catalogBlock}>
                  <View style={styles.catalogHeader}>
                    <Text style={styles.catalogLabel}>Sélection</Text>
                    <Text style={styles.catalogCount}>
                      {products.length} article
                      {products.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catalogRail}
                    decelerationRate="fast"
                    snapToInterval={168}
                  >
                    {products.map((p) => (
                      <Pressable
                        key={`p-${p.id}`}
                        style={({ pressed }) => [
                          styles.productTile,
                          pressed && {
                            opacity: 0.92,
                            transform: [{ scale: 0.98 }],
                          },
                        ]}
                        onPress={() => router.push(`/product/${p.id}` as Href)}
                      >
                        <View style={styles.productMedia}>
                          {p.images?.[0] ? (
                            <Image
                              source={{
                                uri: mediaUrl(p.images[0]) ?? p.images[0],
                              }}
                              style={styles.productImg}
                              contentFit="cover"
                              transition={200}
                            />
                          ) : (
                            <LinearGradient
                              colors={["#1A2230", "#111722"]}
                              style={[
                                styles.productImg,
                                styles.productImgEmpty,
                              ]}
                            >
                              <Ionicons
                                name="bag-handle-outline"
                                size={28}
                                color={MUTED}
                              />
                            </LinearGradient>
                          )}
                          <LinearGradient
                            colors={["transparent", "rgba(5,8,13,0.85)"]}
                            style={styles.productShade}
                          />
                          <View style={styles.pricePill}>
                            <Text style={styles.pricePillText}>
                              {formatMoney(p.priceCents, p.currency)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.productTitle} numberOfLines={2}>
                          {p.title}
                        </Text>
                        <View style={styles.productCta}>
                          <Text style={styles.productCtaText}>Voir</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={12}
                            color={ORANGE}
                          />
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {extraLinks.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.linkRail}
                >
                  {extraLinks.map((link) => (
                    <Pressable
                      key={`${link.kind}-${link.id}`}
                      style={({ pressed }) => [
                        styles.linkChip,
                        pressed && { opacity: 0.88 },
                      ]}
                      onPress={() => router.push(link.href as Href)}
                    >
                      <View style={styles.linkIconWrap}>
                        {link.imageUrl ? (
                          <Image
                            source={{
                              uri: mediaUrl(link.imageUrl) ?? link.imageUrl,
                            }}
                            style={styles.linkAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <Ionicons
                            name={linkIcon(link.kind)}
                            size={16}
                            color={ORANGE}
                          />
                        )}
                      </View>
                      <Text style={styles.linkChipText} numberOfLines={1}>
                        {link.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          );
        }}
      />

      {busy ? (
        <View style={styles.typing}>
          <ActivityIndicator color={ORANGE} size="small" />
          <Text style={styles.typingText}>Recherche…</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(14, insets.bottom + 4) },
        ]}
      >
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Écrivez votre message…"
            placeholderTextColor={MUTED}
            style={styles.input}
            editable={!busy}
            onSubmitEditing={() => void send(input)}
            returnKeyType="send"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendHit,
              pressed && { transform: [{ scale: 0.94 }] },
              { opacity: busy || !input.trim() ? 0.45 : 1 },
            ]}
            disabled={busy || !input.trim()}
            onPress={() => void send(input)}
            accessibilityLabel="Envoyer"
          >
            {/* Maquette : cercle orange + flèche send blanche (avion papier) */}
            <LinearGradient
              colors={["#FF7A3D", "#FF5A1F", "#E8460F"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.send}
            >
              <Ionicons
                name="send"
                size={17}
                color="#FFFFFF"
                style={styles.sendIcon}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  iconHit: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: TEXT, fontSize: 20, fontWeight: "800", letterSpacing: 0.2 },
  list: { paddingHorizontal: 16, paddingBottom: 12, flexGrow: 1 },
  listEmpty: { justifyContent: "flex-start" },
  emptyHero: {
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 6,
  },
  robotWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 0,
    overflow: "hidden",
  },
  robot: {
    width: 220,
    height: 162,
  },
  welcomeBlock: {
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 1,
  },
  welcomeHi: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  welcomeLead: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  welcomeBrand: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 5,
  },
  welcomeSub: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  suggestions: {
    width: "100%",
    gap: 8,
    paddingHorizontal: 2,
  },
  suggestionPress: {
    width: "100%",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 6,
    minHeight: 58,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  suggestionIconGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionIcon: {
    width: 40,
    height: 40,
  },
  suggestionText: {
    flex: 1,
    color: TEXT,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  messageBlock: {
    marginBottom: 16,
    gap: 12,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: "86%",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: ORANGE,
    borderBottomRightRadius: 6,
  },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(17,23,34,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 21, fontWeight: "500" },
  catalogBlock: { gap: 10 },
  catalogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  catalogLabel: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  catalogCount: { color: MUTED, fontSize: 12, fontWeight: "600" },
  catalogRail: {
    gap: 12,
    paddingRight: 8,
    paddingBottom: 2,
  },
  productTile: {
    width: 156,
    borderRadius: 20,
    backgroundColor: "#10151F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    paddingBottom: 10,
  },
  productMedia: {
    width: "100%",
    height: 148,
    backgroundColor: "#0B0F16",
  },
  productImg: { width: "100%", height: "100%" },
  productImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  productShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  pricePill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(5,8,13,0.78)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(0,214,165,0.35)",
  },
  pricePillText: {
    color: "#00D6A5",
    fontSize: 12,
    fontWeight: "800",
  },
  productTitle: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingTop: 8,
    minHeight: 42,
  },
  productCta: {
    marginTop: 4,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  productCtaText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: "800",
  },
  linkRail: {
    gap: 8,
    paddingRight: 8,
  },
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#121821",
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    maxWidth: 200,
  },
  linkIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,90,31,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  linkAvatar: { width: 28, height: 28 },
  linkChipText: {
    flexShrink: 1,
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  typingText: { color: MUTED, fontSize: 12 },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
    minHeight: 54,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
    color: TEXT,
    fontSize: 15,
    fontWeight: "500",
  },
  sendHit: {
    borderRadius: 21,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: ORANGE,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.55,
        shadowRadius: 7,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  /** Avion papier légèrement penché comme sur la maquette. */
  sendIcon: {
    marginLeft: 2,
    transform: [{ rotate: "-12deg" }],
  },
});
