import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import type { PublicTicket } from "@/src/tickets";
import { useColors } from "@/src/use-colors";

export function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const tickets = useQuery({
    queryKey: ["tickets", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ tickets: PublicTicket[] }>("/api/tickets"),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        padding: 16,
        gap: 10,
      }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>{t("back")}</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>{t("myTickets")}</Text>
      {(tickets.data?.tickets ?? []).map((ticket) => (
        <Pressable
          key={ticket.id}
          style={[styles.row, { backgroundColor: c.card }]}
          onPress={() => router.push(`/tickets/${ticket.id}` as Href)}
        >
          <View>
            <Text style={{ color: c.text, fontWeight: "700" }}>
              {ticket.event.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              {ticket.type.name} · {ticket.status} ·{" "}
              {formatMoney(ticket.purchaseCents, ticket.currency)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", includeFontPadding: false },
  row: { borderRadius: 16, padding: 14 },
});
