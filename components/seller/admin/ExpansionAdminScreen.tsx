import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type Wave = {
  id: string;
  title: string;
  weeks: string;
  cities: string[];
  languages: string[];
  partnerFocus: string[];
  launchChecklist: string[];
};

export function ExpansionAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const q = useQuery({
    queryKey: ["admin-expansion", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        waves?: Wave[];
        approach?: string;
        localesReady?: string[];
      }>("/api/admin/expansion-playbook"),
    retry: false,
  });

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Expansion</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {q.data?.approach
            ? `${q.data.approach}. Locales prêtes : ${(q.data.localesReady ?? []).join(", ")}.`
            : "Playbook d’expansion multi-villes"}
        </Text>
      </View>

      {!token ? (
        <Pressable
          style={[styles.primary, { backgroundColor: c.primary }]}
          onPress={openAuth}
        >
          <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
            Se connecter
          </Text>
        </Pressable>
      ) : q.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : q.isError ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Réservé à l’owner ShipShop.
        </Text>
      ) : (
        (q.data?.waves ?? []).map((wave) => (
          <View
            key={wave.id}
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={{ color: c.text, fontWeight: "800" }}>
              {wave.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              {wave.weeks}
            </Text>
            <Text style={{ color: c.text, fontSize: 12 }}>
              Villes : {wave.cities.join(", ")}
            </Text>
            <Text style={{ color: c.text, fontSize: 12 }}>
              Langues : {wave.languages.join(", ")}
            </Text>
            <Text style={{ color: c.text, fontSize: 12 }}>
              Partenaires : {wave.partnerFocus.join(", ")}
            </Text>
            <View style={{ gap: 4, marginTop: 4 }}>
              {wave.launchChecklist.map((item) => (
                <Text key={item} style={{ color: c.textMuted, fontSize: 11 }}>
                  • {item}
                </Text>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
