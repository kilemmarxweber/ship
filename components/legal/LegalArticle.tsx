import { Ionicons } from "@expo/vector-icons";
import { safeBack } from "@/src/nav";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/src/i18n";
import type { LegalSection } from "@/src/legal";
import { useColors } from "@/src/use-colors";

export function LegalArticle({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 16,
        gap: 14,
      }}
    >
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.intro, { color: c.textMuted }]}>{intro}</Text>
      {sections.map((section) => (
        <View
          key={section.title}
          style={[styles.card, { backgroundColor: c.card }]}
        >
          <Text style={[styles.section, { color: c.text }]}>
            {section.title}
          </Text>
          {section.body.map((line) => (
            <Text key={line} style={[styles.body, { color: c.textMuted }]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
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
    overflow: "visible",
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 24, fontWeight: "800" },
  intro: { lineHeight: 20 },
  card: {
    gap: 8,
    borderRadius: 18,
    padding: 14,
  },
  section: { fontWeight: "800", fontSize: 16 },
  body: { lineHeight: 20 },
});
