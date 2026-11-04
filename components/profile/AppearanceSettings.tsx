import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import {
    LOCALE_OPTIONS,
    usePrefs,
    type UserLocale,
    type UserTheme,
} from "@/src/prefs";
import { useSession } from "@/src/session";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function AppearanceSettings() {
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const locale = usePrefs((state) => state.locale);
  const theme = usePrefs((state) => state.theme);
  const setLocale = usePrefs((state) => state.setLocale);
  const setTheme = usePrefs((state) => state.setTheme);

  async function persist(patch: { locale?: UserLocale; theme?: UserTheme }) {
    if (!token) return;
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    } catch {
      // Local preference is already saved.
    }
  }

  async function onLocale(next: UserLocale) {
    if (next === locale) return;
    await setLocale(next);
    await persist({ locale: next });
    showToast(
      next === "en"
        ? t("languageUpdatedEn")
        : next === "pt"
          ? t("languageUpdatedPt")
          : t("languageUpdatedFr"),
      "success",
    );
  }

  async function onTheme(next: UserTheme) {
    if (next === theme) return;
    await setTheme(next);
    await persist({ theme: next });
    showToast(t("themeUpdated"), "success");
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: "rgba(127,127,140,0.22)" },
      ]}
    >
      <Text style={[styles.title, { color: c.text }]}>
        {t("languageAndTheme")}
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {t("appearanceHint")}
      </Text>

      <Text style={[styles.label, { color: c.text }]}>{t("language")}</Text>
      <View style={styles.row}>
        {LOCALE_OPTIONS.map((opt) => {
          const on = locale === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => void onLocale(opt.value)}
              style={[
                styles.lang,
                {
                  backgroundColor: on ? c.buyStart : "rgba(127,127,140,0.12)",
                  borderColor: on ? c.buyStart : "rgba(127,127,140,0.18)",
                },
              ]}
            >
              <Text
                style={[styles.langName, { color: on ? "#fff" : c.text }]}
                numberOfLines={1}
              >
                {opt.nativeLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: c.text, marginTop: 8 }]}>
        {t("theme")}
      </Text>
      <View style={styles.themeRow}>
        <Pressable
          onPress={() => void onTheme("light")}
          style={[
            styles.themeBtn,
            {
              borderColor:
                theme === "light" ? c.buyStart : "rgba(127,127,140,0.25)",
            },
          ]}
        >
          <View style={styles.previewLight}>
            <View style={styles.previewCardLight} />
            <View style={styles.previewLineLight} />
          </View>
          <Text style={[styles.themeLabel, { color: c.text }]}>
            {t("themeLight")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void onTheme("dark")}
          style={[
            styles.themeBtn,
            {
              borderColor:
                theme === "dark" ? c.buyStart : "rgba(127,127,140,0.25)",
            },
          ]}
        >
          <View style={styles.previewDark}>
            <View style={styles.previewCardDark} />
            <View style={styles.previewLineDark} />
          </View>
          <Text style={[styles.themeLabel, { color: c.text }]}>
            {t("themeDark")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "800" },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  row: { flexDirection: "row", gap: 8 },
  lang: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  langName: {
    fontWeight: "800",
    fontSize: 13,
    includeFontPadding: false,
  },
  themeRow: { flexDirection: "row", gap: 10 },
  themeBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  previewLight: {
    height: 72,
    borderRadius: 10,
    backgroundColor: "#ecedef",
    padding: 8,
    gap: 6,
  },
  previewCardLight: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  previewLineLight: {
    height: 8,
    width: "70%",
    borderRadius: 4,
    backgroundColor: "#d9d9e1",
  },
  previewDark: {
    height: 72,
    borderRadius: 10,
    backgroundColor: "#020617",
    padding: 8,
    gap: 6,
  },
  previewCardDark: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  previewLineDark: {
    height: 8,
    width: "70%",
    borderRadius: 4,
    backgroundColor: "#64748b",
  },
  themeLabel: { textAlign: "center", fontWeight: "800", fontSize: 13 },
});
