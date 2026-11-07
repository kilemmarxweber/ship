import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParcelMap } from "@/components/orders/ParcelMap";
import { QrCard } from "@/components/orders/QrCard";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import {
    courierPoint,
    destinationPoint,
    isAwaitingConfirm,
    isLiveTracking,
    isTransitStepActive,
    liveEtaText,
    statusLabel,
    type OrderDetail,
} from "@/src/orders";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

export function OrderScreen({ orderId }: { orderId: string }) {
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["order", orderId, token ?? "guest"],
    enabled: Boolean(token && orderId),
    queryFn: () => api<{ order: OrderDetail }>(`/api/orders/${orderId}`),
    refetchInterval: (query) => {
      const order = query.state.data?.order;
      if (!order) return false;
      return isLiveTracking(order) || isAwaitingConfirm(order) ? 4000 : false;
    },
  });

  const order = orderQuery.data?.order;
  const live = order ? isLiveTracking(order) : false;
  const awaiting = order ? isAwaitingConfirm(order) : false;
  const handedOver = Boolean(order?.pickupReceipt?.redeemedAt);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  async function confirmReceipt() {
    if (!order) return;
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/confirm-receipt`, { method: "POST" });
      showToast("Réception confirmée", "success");
      await orderQuery.refetch();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Confirmation impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Suivi commande</Text>
        <Pressable style={styles.cta} onPress={openAuth}>
          <Text style={styles.ctaText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Commande introuvable</Text>
        <Pressable onPress={() => safeBack()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const total = order.totalCents || order.amountCents || 0;
  const pickup = order.fulfillmentType === "PICKUP";
  const qrPayload =
    order.handover?.qrPayload ?? order.pickupReceipt?.qrPayload ?? "";
  const eta = liveEtaText(order, now);
  const cover = mediaUrl(order.product.images[0]);

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
      <Pressable style={styles.back} onPress={() => safeBack()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
        <Text style={styles.backText} numberOfLines={1}>
          Retour{"\u00A0"}
        </Text>
      </Pressable>
      <Text style={styles.title}>Suivi commande</Text>
      <Text style={styles.sub}>
        {handedOver
          ? "Vendeur payé"
          : isTransitStepActive(order)
            ? pickup
              ? "Prêt au retrait"
              : "En route"
            : "Paiement bloqué"}
      </Text>

      <View style={styles.steps}>
        <Step on label="Bloqué" />
        <Step
          on={isTransitStepActive(order)}
          label={pickup ? "Retrait" : "Course"}
        />
        <Step on={handedOver} label="Payé vendeur" />
      </View>

      <View style={styles.card}>
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
          <Text style={styles.product} numberOfLines={2}>
            {order.product.title}
          </Text>
          <Text style={styles.shop}>@{order.shop.name}</Text>
          <Text style={styles.price}>{formatMoney(total)}</Text>
          <Text style={styles.meta}>
            {pickup
              ? "Retrait boutique"
              : `Livraison · ${order.deliveryCommune ?? ""}`}
            {" · "}
            {statusLabel(order.status)}
          </Text>
        </View>
      </View>

      {order.deliveryAddress ? (
        <Text style={styles.address}>
          <Ionicons name="location" size={13} color={colors.muted} />{" "}
          {order.deliveryAddress}
        </Text>
      ) : null}

      {order.courier ? (
        <Text style={styles.meta}>
          Livreur: {order.courier.name ?? "—"}
          {order.courier.phone ? ` · ${order.courier.phone}` : ""}
        </Text>
      ) : null}

      {order.fulfillmentType === "DELIVERY" && order.courier ? (
        <View style={{ gap: 8 }}>
          <View style={styles.liveHead}>
            <Text style={styles.liveTitle}>Suivi live</Text>
            {live ? <Text style={styles.pulse}>● Temps réel</Text> : null}
          </View>
          <ParcelMap
            courier={courierPoint(order.courier)}
            destination={destinationPoint(order)}
            etaText={eta}
            distanceKm={order.courierDistanceKm}
            live={live}
            label={live ? "En route" : statusLabel(order.status)}
          />
          {order.proximityNotifiedAt ? (
            <Text style={styles.warn}>Livreur signalé à moins de 100 m</Text>
          ) : null}
        </View>
      ) : null}

      {awaiting && !handedOver ? (
        <View style={styles.scanBox}>
          <Text style={styles.scanTitle}>QR scanné par le vendeur</Text>
          <Text style={styles.hint}>
            Confirme que tu as bien reçu le colis pour libérer le paiement.
          </Text>
          <Pressable
            style={styles.cta}
            disabled={busy}
            onPress={() => void confirmReceipt()}
          >
            <Text style={styles.ctaText}>
              {busy ? "…" : "Confirmer la réception"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {qrPayload && !handedOver ? (
        <QrCard
          payload={qrPayload}
          code={order.handover?.code ?? order.pickupReceipt?.code}
          hint={`Présente ce QR chez ${order.shop.name}. Une fois scanné et confirmé, ce produit est payé.`}
        />
      ) : null}

      {handedOver ? (
        <View style={styles.done}>
          <Text style={styles.doneText}>Remise confirmée</Text>
        </View>
      ) : null}

      {order.handover?.id ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/orders/ticket/[id]",
              params: { id: order.handover?.id ?? "" },
            })
          }
        >
          <Text style={styles.link}>Voir le QR boutique</Text>
        </Pressable>
      ) : null}

      {(order.deliveryEvents ?? []).length ? (
        <View style={styles.events}>
          <Text style={styles.liveTitle}>Parcours du colis</Text>
          {order.deliveryEvents?.map((event) => (
            <Text key={event.id} style={styles.event}>
              {statusLabel(event.status)}
              {event.note ? ` · ${event.note}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Step({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={[styles.step, on && styles.stepOn]}>
      <Text style={[styles.stepText, on && styles.stepTextOn]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  sub: { color: colors.muted, marginTop: -8 },
  steps: { flexDirection: "row", gap: 6 },
  step: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 8,
    alignItems: "center",
  },
  stepOn: {
    borderColor: "rgba(0,214,143,0.4)",
    backgroundColor: "rgba(0,214,143,0.12)",
  },
  stepText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  stepTextOn: { color: colors.emerald },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#222",
  },
  product: { color: "#fff", fontWeight: "800" },
  shop: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: colors.emerald, fontWeight: "800", marginTop: 4 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  address: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  liveHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveTitle: { color: "#fff", fontWeight: "800" },
  pulse: { color: colors.emerald, fontSize: 11, fontWeight: "800" },
  warn: { color: "#fbbf24", fontWeight: "700", fontSize: 12 },
  scanBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(251,191,36,0.1)",
    padding: 14,
    gap: 8,
  },
  scanTitle: { color: "#fcd34d", fontWeight: "800" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cta: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: { color: "#04281c", fontWeight: "800" },
  done: {
    borderRadius: 18,
    backgroundColor: "rgba(0,214,143,0.12)",
    padding: 18,
    alignItems: "center",
  },
  doneText: { color: colors.emerald, fontWeight: "800" },
  link: { color: colors.emerald, fontWeight: "700" },
  events: { gap: 6 },
  event: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
