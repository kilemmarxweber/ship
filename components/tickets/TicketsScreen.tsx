import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { safeBack } from "@/src/nav";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventPoster } from "@/components/events/EventPoster";
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
        gap: 12,
        paddingBottom: insets.bottom + 28,
      }}
    >
      <Pressable onPress={() => safeBack()}>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>{t("back")}</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>{t("myTickets")}</Text>
      {(tickets.data?.tickets ?? []).map((ticket) => (
        <Pressable
          key={ticket.id}
          style={[styles.row, { backgroundColor: c.card }]}
          onPress={() => router.push(`/tickets/${ticket.id}` as Href)}
        >
          <EventPoster
            eventId={ticket.event.id}
            imageUrl={ticket.event.imageUrl}
            title={ticket.event.title}
            compact
            style={styles.thumb}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              style={{ color: c.text, fontWeight: "800" }}
              numberOfLines={2}
            >
              {ticket.event.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              {ticket.type.name} · {ticket.status}
            </Text>
            <Text style={{ color: c.emerald, fontWeight: "800" }}>
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
  row: {
    borderRadius: 18,
    padding: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  thumb: { width: 92, height: 118, borderRadius: 14, minHeight: 118 },
});
