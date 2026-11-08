import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceCard } from "@/components/publish/ChoiceCard";
import { OnboardFlow } from "@/components/publish/OnboardFlow";
import { SellFlow, type SellShop } from "@/components/publish/SellFlow";
import { WantedFlow } from "@/components/publish/WantedFlow";
import { api } from "@/src/api";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

export default function PublishScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const params = useLocalSearchParams<{ mode?: string; shopId?: string }>();
  const mode = typeof params.mode === "string" ? params.mode : undefined;
  const initialShopId =
    typeof params.shopId === "string" ? params.shopId : undefined;

  const shops = useQuery({
    queryKey: ["my-shops", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ shops?: SellShop[] }>("/api/shops?mine=1"),
  });
  const shopList = shops.data?.shops ?? [];
  const hasShop = shopList.length > 0;

  function goChooser() {
    router.replace("/publish");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: c.background,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 88,
          },
        ]}
      >
        {!token ? (
          <View style={styles.center}>
            <View style={[styles.iconBubble, { backgroundColor: c.primary }]}>
              <Ionicons name="add" size={28} color={c.primaryForeground} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>Publier</Text>
            <Text style={[styles.text, { color: c.textMuted }]}>
              Connecte-toi pour publier en vidéo ou demander un article.
            </Text>
            <Pressable
              style={[styles.primary, { backgroundColor: c.primary }]}
              onPress={openAuth}
            >
              <Text
                style={[styles.primaryText, { color: c.primaryForeground }]}
              >
                Se connecter
              </Text>
            </Pressable>
          </View>
        ) : mode === "wanted" ? (
          <WantedFlow onBack={goChooser} />
        ) : mode === "onboard" ? (
          <OnboardFlow
            onBack={goChooser}
            onCreated={() => router.replace("/shops" as Href)}
          />
        ) : mode === "sell" && shops.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.text, { color: c.textMuted }]}>
              Chargement de tes boutiques…
            </Text>
          </View>
        ) : mode === "sell" && !hasShop ? (
          <OnboardFlow
            onBack={goChooser}
            onCreated={() => router.setParams({ mode: "sell" })}
          />
        ) : mode === "sell" ? (
          <SellFlow
            shops={shopList}
            initialShopId={initialShopId}
            onBack={goChooser}
            onNeedShop={() => router.setParams({ mode: "sell" })}
          />
        ) : (
          <View style={styles.chooser}>
            <Animated.View
              entering={FadeInDown.springify().damping(16)}
              style={styles.hero}
            >
              <Text style={[styles.kicker, { color: c.primary }]}>
                Publication
              </Text>
              <Text style={[styles.title, { color: c.text }]}>
                Que veux-tu publier ?
              </Text>
              <Text
                style={[styles.text, { color: c.textMuted, textAlign: "left" }]}
              >
                Publie un article, ou demande ce que tu cherches — tout le
                monde voit les demandes.
              </Text>
            </Animated.View>
            <ChoiceCard
              icon="bag-add"
              title="Publier un article"
              subtitle="Publier en vidéo — 3 gestes : vidéo, prix, poster"
              delay={40}
              onPress={() => router.setParams({ mode: "sell" })}
            />
            <ChoiceCard
              icon="search"
              title="Je cherche"
              subtitle="Budget, neuf ou occasion — les Business te répondent"
              delay={110}
              onPress={() => router.setParams({ mode: "wanted" })}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  chooser: { gap: 14, marginTop: 8 },
  hero: { gap: 8, marginBottom: 4 },
  kicker: {
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "800" },
  text: {
    lineHeight: 22,
    textAlign: "center",
  },
  primary: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  primaryText: { fontWeight: "800" },
});
