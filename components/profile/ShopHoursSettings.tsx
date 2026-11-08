import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import {
    WEEKDAY_LABEL,
    WEEKDAY_UI,
    hoursAreConfigured,
    parseWorkDays,
    type WeekdayJs,
} from "@/src/shop-hours";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
  workDays?: unknown;
  owner?: { name?: string | null } | null;
};

type HoursDraft = {
  shopId: string;
  alwaysOpen: boolean;
  hoursStart: string;
  hoursEnd: string;
  workDays: WeekdayJs[];
};

const EMPTY_SHOPS: ShopRow[] = [];

function initialDraft(shop: ShopRow | null): HoursDraft {
  const configured = shop ? hoursAreConfigured(shop) : false;
  const days = shop ? parseWorkDays(shop.workDays) : [];
  return {
    shopId: shop?.id ?? "",
    alwaysOpen: Boolean(shop?.alwaysOpen) || !configured,
    hoursStart: shop?.hoursStart ?? "08:00",
    hoursEnd: shop?.hoursEnd ?? "18:00",
    workDays: configured && days.length ? days : [1, 2, 3, 4, 5],
  };
}

export function ShopHoursSettings() {
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const queryClient = useQueryClient();
  const shops = useQuery({
    queryKey: ["shops", "mine", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ shops?: ShopRow[] }>("/api/shops?mine=1"),
  });
  const list = shops.data?.shops ?? EMPTY_SHOPS;
  const [shopId, setShopId] = useState("");
  const [draft, setDraft] = useState<HoursDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const shop =
    list.find((row) => row.id === shopId) ?? list[0] ?? null;
  const selectedId = shop?.id ?? "";
  const values =
    draft?.shopId === selectedId ? draft : initialDraft(shop);

  function updateDraft(patch: Partial<HoursDraft>) {
    if (!shop) return;
    setDraft((current) => ({
      ...(current?.shopId === selectedId ? current : initialDraft(shop)),
      ...patch,
      shopId: selectedId,
    }));
  }

  if (!token || list.length === 0) return null;

  async function save() {
    if (!shop) return;
    setBusy(true);
    try {
      await api(`/api/shops/${shop.slug}`, {
        method: "PATCH",
        body: JSON.stringify({
          alwaysOpen: values.alwaysOpen,
          hoursStart: values.alwaysOpen ? null : values.hoursStart,
          hoursEnd: values.alwaysOpen ? null : values.hoursEnd,
          workDays: values.alwaysOpen ? [] : values.workDays,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["shops", "mine"] });
      showToast(t("hoursSaved"), "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : t("hoursFailed"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: "rgba(127,127,140,0.22)" },
      ]}
    >
      <Text style={[styles.title, { color: c.text }]}>{t("hoursTitle")}</Text>
      {list.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.shopLabel, { color: c.text }]}>
            {t("hoursShop")}
          </Text>
          <ShopPicker
            shops={list}
            value={selectedId}
            onChange={setShopId}
            placeholder={t("hoursShop")}
          />
        </View>
      ) : null}
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => updateDraft({ alwaysOpen: true })}
          style={[
            styles.mode,
            {
              borderColor: values.alwaysOpen ? c.buyStart : "rgba(127,127,140,0.22)",
              backgroundColor: values.alwaysOpen
                ? "rgba(255,77,141,0.12)"
                : "transparent",
            },
          ]}
        >
          <Text style={[styles.modeText, { color: c.text }]}>
            {t("hoursAlways")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => updateDraft({ alwaysOpen: false })}
          style={[
            styles.mode,
            {
              borderColor: !values.alwaysOpen ? c.buyStart : "rgba(127,127,140,0.22)",
              backgroundColor: !values.alwaysOpen
                ? "rgba(255,77,141,0.12)"
                : "transparent",
            },
          ]}
        >
          <Text style={[styles.modeText, { color: c.text }]}>
            {t("hoursScheduled")}
          </Text>
        </Pressable>
      </View>
      {!values.alwaysOpen ? (
        <>
          <View style={styles.timeRow}>
            <TextInput
              value={values.hoursStart}
              onChangeText={(hoursStart) => updateDraft({ hoursStart })}
              placeholder="08:00"
              placeholderTextColor={c.textMuted}
              style={[
                styles.time,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <Text style={{ color: c.textMuted }}>—</Text>
            <TextInput
              value={values.hoursEnd}
              onChangeText={(hoursEnd) => updateDraft({ hoursEnd })}
              placeholder="18:00"
              placeholderTextColor={c.textMuted}
              style={[
                styles.time,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
          </View>
          <View style={styles.days}>
            {WEEKDAY_UI.map((day) => {
              const on = values.workDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() =>
                    updateDraft({
                      workDays: values.workDays.includes(day)
                        ? values.workDays.filter((item) => item !== day)
                        : [...values.workDays, day].sort(),
                    })
                  }
                  style={[
                    styles.day,
                    {
                      backgroundColor: on
                        ? c.buyStart
                        : "rgba(127,127,140,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={{ color: on ? "#fff" : c.text, fontWeight: "800" }}
                  >
                    {WEEKDAY_LABEL[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      <Pressable
        onPress={() => void save()}
        disabled={busy}
        style={[
          styles.save,
          { backgroundColor: c.emerald, opacity: busy ? 0.6 : 1 },
        ]}
      >
        <Text style={styles.saveText}>{busy ? "…" : "Enregistrer"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  title: { fontSize: 16, fontWeight: "800" },
  shopLabel: { fontSize: 13, fontWeight: "700" },
  modeRow: { flexDirection: "row", gap: 8 },
  mode: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 12 },
  modeText: { fontWeight: "800", fontSize: 13 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  time: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  save: { borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#04281c", fontWeight: "800" },
});
