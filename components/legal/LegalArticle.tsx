import { IconBackButton } from "@/components/ui/IconBackButton";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      <IconBackButton color={c.text} />
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
