import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QrCard } from "@/components/orders/QrCard";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import type { PublicTicket } from "@/src/tickets";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function TicketPassScreen({ ticketId }: { ticketId: string }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const [reason, setReason] = useState("");
  const ticket = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api<{ ticket: PublicTicket }>(`/api/tickets/${ticketId}`),
  });
  const row = ticket.data?.ticket;

  async function requestRefund() {
    try {
      await api(`/api/tickets/${ticketId}/refund-request`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast("Demande envoyée");
      void ticket.refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible");
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
      <Pressable onPress={() => safeBack()}>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>{t("back")}</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>
        {row?.event.title ?? "…"}
      </Text>
      <Text style={{ color: c.textMuted }}>
        {row ? `${row.event.organizerName} · ${row.type.name}` : ""}
      </Text>
      {row ? (
        <QrCard
          payload={row.qrPayload}
          code={row.code}
          hint={t("ticketAccess")}
        />
      ) : null}
      <Text style={{ color: c.text }}>
        {row ? formatMoney(row.purchaseCents, row.currency) : ""} ·{" "}
        {row?.status}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>
        {t("ticketNonRefundable")}
      </Text>
      {row?.status === "PAID" && !row.refundRequest ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("ticketRefund")}
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text, borderColor: c.textMuted }]}
          />
          <Pressable
            style={[styles.btn, { borderColor: c.emerald }]}
            onPress={() => void requestRefund()}
          >
            <Text style={{ color: c.emerald, fontWeight: "700" }}>
              {t("ticketRefund")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", includeFontPadding: false },
  input: { borderWidth: 1, borderRadius: 12, padding: 10 },
  btn: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
});
