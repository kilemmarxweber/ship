import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, apiPayment } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import {
    clearPaymentIdempotencyKey,
    paymentIdempotencyKey,
} from "@/src/pay-idempotency";
import { useSession } from "@/src/session";
import type { PublicEvent } from "@/src/tickets";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function EventScreen({ eventId }: { eventId: string }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api<{ event: PublicEvent }>(`/api/events/${eventId}`),
  });
  const row = event.data?.event;
  const selected = typeId ?? row?.ticketTypes[0]?.id ?? null;

  async function buy() {
    if (!token) {
      openAuth();
      return;
    }
    if (!row || !selected) return;
    if (!accepted) {
      showToast(t("ticketAccept"));
      return;
    }
    setBusy(true);
    const intent = `ticket:${row.id}:${selected}`;
    const key = await paymentIdempotencyKey(intent);
    try {
      const data = await apiPayment<{ tickets?: { id: string }[] }>(
        `/api/events/${row.id}/checkout`,
        {
          method: "POST",
          idempotencyKey: key,
          replayScope: "TICKET",
          body: JSON.stringify({
            ticketTypeId: selected,
            qty: 1,
            acceptedNonRefundable: true,
          }),
        },
      );
      await clearPaymentIdempotencyKey(intent);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      const first = data.tickets?.[0]?.id;
      showToast("Billet acheté");
      router.push((first ? `/tickets/${first}` : "/tickets") as Href);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Achat impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        padding: 16,
        gap: 12,
      }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>{t("back")}</Text>
      </Pressable>
      {row?.imageUrl ? (
        <Image
          source={{ uri: row.imageUrl }}
          style={styles.cover}
          contentFit="cover"
        />
      ) : null}
      <Text style={[styles.kicker, { color: c.textMuted }]}>
        {row?.organizerName}
      </Text>
      <Text style={[styles.title, { color: c.text }]}>{row?.title ?? "…"}</Text>
      <Text style={{ color: c.textMuted }}>
        {row ? `${row.venue}, ${row.city}` : ""}
      </Text>
      <Text style={{ color: c.textMuted }}>{row?.description}</Text>
      {row?.ticketTypes.map((type) => (
        <Pressable
          key={type.id}
          onPress={() => setTypeId(type.id)}
          style={[
            styles.type,
            {
              borderColor:
                selected === type.id ? c.emerald : "rgba(255,255,255,0.12)",
              backgroundColor: c.card,
            },
          ]}
        >
          <Text style={{ color: c.text, fontWeight: "700" }}>{type.name}</Text>
          <Text style={{ color: c.emerald }}>
            {formatMoney(type.priceCents, row.currency)}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setAccepted((v) => !v)} style={styles.check}>
        <Text style={{ color: c.text }}>
          {accepted ? "☑ " : "☐ "}
          {t("ticketNonRefundable")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.buy, { backgroundColor: c.emerald }]}
        disabled={busy}
        onPress={() => void buy()}
      >
        <Text style={styles.buyText}>{t("ticketBuy")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 180, borderRadius: 18 },
  kicker: { fontSize: 12, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", includeFontPadding: false },
  type: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  check: { paddingVertical: 6 },
  buy: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  buyText: { color: "#04140E", fontWeight: "800" },
});
