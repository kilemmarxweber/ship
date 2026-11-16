import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
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

import { QrCard } from "@/components/orders/QrCard";
import { api, mediaUrl } from "@/src/api";
import { useSession } from "@/src/session";

type Ticket = {
  id: string;
  code: string;
  qrPayload: string;
  completedAt: string | null;
  shop: { id: string; name: string };
  orders: {
    id: string;
    status: string;
    product: { title: string; images: string[] };
    pickupReceipt: {
      scannedAt: string | null;
      redeemedAt: string | null;
      qrPayload?: string | null;
    } | null;
  }[];
};

export function TicketScreen({ ticketId }: { ticketId: string }) {
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);

  const ticketQuery = useQuery({
    queryKey: ["handover", ticketId, token ?? "guest"],
    enabled: Boolean(token && ticketId),
    queryFn: () => api<{ handover: Ticket }>(`/api/handovers/${ticketId}`),
  });

  const ticket = ticketQuery.data?.handover;

  if (ticketQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00D68F" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>QR introuvable</Text>
        <Pressable
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 14,
      }}
    >
      <Pressable accessibilityLabel="Retour" style={styles.back} onPress={() => safeBack()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
        
      </Pressable>
      <Text style={styles.title}>QR boutique</Text>
      <Text style={styles.sub}>
        @{ticket.shop.name} — valable jusqu’au dernier article
      </Text>

      {ticket.completedAt ? (
        <Text style={styles.done}>
          Boutique terminée — plus d’article à remettre
        </Text>
      ) : (
        <QrCard
          payload={ticket.qrPayload}
          code={ticket.code}
          hint="Présente ce QR en boutique ou au livreur pour la remise."
        />
      )}

      {ticket.orders.map((item) => {
        const done =
          Boolean(item.pickupReceipt?.redeemedAt) ||
          ["DELIVERED", "PICKED_UP", "CANCELLED", "REFUNDED"].includes(
            item.status,
          );
        const payload = item.pickupReceipt?.qrPayload ?? ticket.qrPayload;
        const cover = mediaUrl(item.product.images[0]);
        return (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/orders/[id]",
                params: { id: item.id },
              })
            }
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.product.title}
              </Text>
              <Text style={styles.itemMeta}>
                {done
                  ? "Remis"
                  : item.pickupReceipt?.scannedAt
                    ? "Scanné"
                    : "À remettre"}
              </Text>
            </View>
            {!done && payload ? (
              <Ionicons name="qr-code" size={18} color="#00D68F" />
            ) : (
              <Ionicons name="checkmark-circle" size={18} color="#00D68F" />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0F" },
  center: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
    minWidth: 44,
    minHeight: 44,

  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.72)", marginTop: -8 },
  done: { color: "#00D68F", fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#222" },
  itemTitle: { color: "#fff", fontWeight: "700" },
  itemMeta: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 2 },
});
