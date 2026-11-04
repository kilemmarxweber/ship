import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { PagedMore } from "@/components/ui/PagedMore";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import {
    CANCEL_REASON_CODES,
    CANCEL_REASONS,
    isOrderCancellable,
    resolveSaleFeeCents,
    type CancelReasonCode,
} from "@/src/order-cancel";
import { statusLabel } from "@/src/orders";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { usePaged } from "@/src/use-paged";
import { useColors } from "@/src/use-colors";

type Shop = { id: string; name: string };
type Courier = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  isAvailable: boolean;
};
type VendorOrder = {
  id: string;
  status: string;
  totalCents: number;
  amountCents: number;
  productCents?: number;
  saleFeeCents?: number;
  saleFeeBps?: number;
  fulfillmentType: string;
  deliveryCommune: string | null;
  deliveryAddress: string | null;
  contactPhone: string | null;
  product: { title: string; images: string[] };
  buyer: { name: string; phone: string | null };
  courier: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  pickupReceipt: {
    code: string;
    redeemedAt: string | null;
    scannedAt: string | null;
  } | null;
  handover?: { id: string; code: string; completedAt: string | null } | null;
};

export function SellerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [shopId, setShopId] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] =
    useState<CancelReasonCode>("OUT_OF_STOCK");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const shopsQ = useQuery({
    queryKey: ["seller-order-shops", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ shops?: Shop[] }>("/api/shops?mine=1"),
  });
  const shops = shopsQ.data?.shops ?? [];

  useEffect(() => {
    if (!shopId && shops[0]?.id) setShopId(shops[0].id);
  }, [shops, shopId]);

  const ordersQ = useQuery({
    queryKey: ["seller-orders", token ?? "guest", shopId],
    enabled: Boolean(token && shopId),
    queryFn: () =>
      api<{ orders?: VendorOrder[] }>(
        `/api/orders?shopId=${shopId}&status=all`,
      ),
  });
  const couriersQ = useQuery({
    queryKey: ["seller-couriers", token ?? "guest", shopId],
    enabled: Boolean(token && shopId),
    queryFn: () =>
      api<{ couriers?: Courier[] }>(
        `/api/shops/delivery/couriers?shopId=${shopId}`,
      ).catch(() => ({ couriers: [] as Courier[] })),
  });

  const orders = ordersQ.data?.orders ?? [];
  const couriers = couriersQ.data?.couriers ?? [];
  const paged = usePaged(orders, `${shopId}-${orders.length}`);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
  }

  async function confirmHandover(body: {
    orderId?: string;
    code?: string;
    qrPayload?: string;
  }) {
    setScanBusy(true);
    try {
      await api("/api/orders/handover/confirm", {
        method: "POST",
        body: JSON.stringify(body),
      });
      showToast("Remise confirmée", "success");
      setScanInput("");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "QR / code non reconnu",
        "error",
      );
    } finally {
      setScanBusy(false);
    }
  }

  async function onScanSubmit() {
    const raw = scanInput.trim();
    if (!raw) return;
    if (raw.startsWith("{") || raw.includes("handover")) {
      await confirmHandover({ qrPayload: raw });
      return;
    }
    const match = orders.find(
      (o) =>
        o.pickupReceipt &&
        !o.pickupReceipt.redeemedAt &&
        (o.pickupReceipt.code.toUpperCase() === raw.toUpperCase() ||
          o.handover?.code.toUpperCase() === raw.toUpperCase()),
    );
    if (!match) {
      showToast("Code introuvable dans les commandes ouvertes", "error");
      return;
    }
    await confirmHandover({
      orderId: match.handover ? undefined : match.id,
      code: raw,
    });
  }

  async function setStatus(orderId: string, status: string) {
    try {
      await api(`/api/orders/${orderId}/events`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      showToast(`Statut → ${status}`, "success");
      await refresh();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Échec", "error");
    }
  }

  async function assignCourier(orderId: string, courierId?: string) {
    try {
      const data = await api<{
        eta?: { etaText: string; distanceKm: number };
        order?: { courier?: { name: string; address?: string | null } | null };
      }>(`/api/orders/${orderId}/assign-courier`, {
        method: "POST",
        body: JSON.stringify(courierId ? { courierId } : { auto: true }),
      });
      const who = data.order?.courier?.name ?? "Livreur";
      showToast(
        data.eta
          ? `${who} · ${data.eta.distanceKm} km · ETA ${data.eta.etaText}`
          : `${who} assigné`,
        "success",
      );
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Assignation impossible",
        "error",
      );
    }
  }

  async function vendorCancel() {
    if (!cancelOrderId) return;
    setCancelBusy(true);
    try {
      const data = await api<{ message?: string }>(
        `/api/orders/${cancelOrderId}/vendor-cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: cancelReason,
            note: cancelNote.trim() || undefined,
          }),
        },
      );
      showToast(data.message ?? "Commande annulée — client remboursé", "success");
      setCancelOrderId(null);
      setCancelNote("");
      setCancelReason("OUT_OF_STOCK");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Annulation impossible",
        "error",
      );
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
            {t("back")}
            {"\u00A0"}
          </Text>
        </Pressable>
        <View>
          <Text style={[styles.title, { color: c.text }]}>
            Commandes boutique
          </Text>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Scan QR / code pour confirmer la remise
          </Text>
        </View>

        {!token ? (
          <Pressable
            style={[styles.primary, { backgroundColor: c.primary }]}
            onPress={openAuth}
          >
            <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
              Se connecter
            </Text>
          </Pressable>
        ) : (
          <>
            <View
              style={[
                styles.scanCard,
                { backgroundColor: `${c.primary}18`, borderColor: `${c.primary}55` },
              ]}
            >
              <Text style={{ color: c.primary, fontWeight: "800", fontSize: 12 }}>
                Valider une remise (QR ou code)
              </Text>
              <TextInput
                value={scanInput}
                onChangeText={setScanInput}
                placeholder='Code (ex. "AB12CD") ou JSON QR'
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  { color: c.text, backgroundColor: c.card },
                ]}
              />
              <Pressable
                disabled={scanBusy || !scanInput.trim()}
                onPress={() => void onScanSubmit()}
                style={[
                  styles.primary,
                  {
                    backgroundColor: c.primary,
                    opacity: scanBusy || !scanInput.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
                  {scanBusy ? "…" : "Confirmer"}
                </Text>
              </Pressable>
              <Text style={{ color: c.textMuted, fontSize: 10 }}>
                Après confirmation, le client ne peut plus demander de
                remboursement.
              </Text>
            </View>

            <ShopPicker shops={shops} value={shopId} onChange={setShopId} />

            {!shopId || ordersQ.isLoading ? (
              <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />
            ) : orders.length === 0 ? (
              <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 28 }}>
                Aucune commande
              </Text>
            ) : (
              <>
                {paged.visible.map((o) => {
                  const redeemed = Boolean(o.pickupReceipt?.redeemedAt);
                  const awaitingClient =
                    o.status === "AWAITING_CONFIRM" ||
                    Boolean(o.pickupReceipt?.scannedAt && !redeemed);
                  const canCancel = isOrderCancellable(
                    o.status,
                    o.pickupReceipt?.redeemedAt,
                    o.pickupReceipt?.scannedAt,
                  );
                  const cover = mediaUrl(o.product.images[0]);
                  const fee =
                    o.productCents != null
                      ? resolveSaleFeeCents(
                          o.productCents,
                          o.saleFeeCents,
                          o.saleFeeBps,
                        )
                      : 0;
                  return (
                    <View
                      key={o.id}
                      style={[
                        styles.card,
                        { backgroundColor: c.card, borderColor: HAIRLINE },
                      ]}
                    >
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        {cover ? (
                          <Image
                            source={{ uri: cover }}
                            style={styles.thumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.thumb,
                              { backgroundColor: "rgba(127,127,140,0.2)" },
                            ]}
                          />
                        )}
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: c.text, fontWeight: "800" }} numberOfLines={1}>
                            {o.product.title}
                          </Text>
                          <Text style={{ color: c.textMuted, fontSize: 11 }}>
                            {o.buyer.name} · {o.contactPhone || o.buyer.phone || "—"}
                          </Text>
                          <Text style={{ color: c.textMuted, fontSize: 11 }}>
                            {statusLabel(o.status)} · {o.fulfillmentType} ·{" "}
                            {formatMoney(o.totalCents || o.amountCents)}
                            {o.productCents != null
                              ? ` · net ${formatMoney(Math.max(0, o.productCents - fee))}`
                              : ""}
                          </Text>
                          {awaitingClient ? (
                            <Text style={{ color: "#FBBF24", fontSize: 11 }}>
                              Attente confirmation client
                            </Text>
                          ) : null}
                          {redeemed ? (
                            <Text style={{ color: c.emerald, fontSize: 11 }}>
                              Livré SUCCESS
                            </Text>
                          ) : null}
                          {o.courier ? (
                            <Text style={{ color: c.emerald, fontSize: 11 }}>
                              Livreur: {o.courier.name}
                              {o.courier.phone ? ` · ${o.courier.phone}` : ""}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => router.push(`/orders/${o.id}` as Href)}
                          style={[styles.chip, { borderColor: HAIRLINE }]}
                        >
                          <Text style={{ color: c.text, fontWeight: "700", fontSize: 11 }}>
                            Suivi
                          </Text>
                        </Pressable>
                        {o.fulfillmentType === "DELIVERY" &&
                        !redeemed &&
                        !awaitingClient ? (
                          <>
                            <Pressable
                              onPress={() => void assignCourier(o.id)}
                              style={[styles.chip, { backgroundColor: "rgba(127,127,140,0.14)" }]}
                            >
                              <Text style={{ color: c.text, fontWeight: "700", fontSize: 11 }}>
                                Auto-livreur
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void setStatus(o.id, "OUT_FOR_DELIVERY")}
                              style={[styles.chip, { backgroundColor: "rgba(127,127,140,0.14)" }]}
                            >
                              <Text style={{ color: c.text, fontWeight: "700", fontSize: 11 }}>
                                En livraison
                              </Text>
                            </Pressable>
                          </>
                        ) : null}
                        {canCancel ? (
                          <Pressable
                            onPress={() => setCancelOrderId(o.id)}
                            style={[styles.chip, { borderColor: "rgba(255,69,58,0.4)" }]}
                          >
                            <Text style={{ color: "#FF453A", fontWeight: "700", fontSize: 11 }}>
                              Annuler
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {o.fulfillmentType === "DELIVERY" &&
                      !redeemed &&
                      !awaitingClient &&
                      couriers.filter((x) => x.isAvailable).length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {couriers
                              .filter((x) => x.isAvailable)
                              .map((courier) => (
                                <Pressable
                                  key={courier.id}
                                  onPress={() => void assignCourier(o.id, courier.id)}
                                  style={[styles.chip, { borderColor: HAIRLINE }]}
                                >
                                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                                    {courier.name}
                                  </Text>
                                </Pressable>
                              ))}
                          </View>
                        </ScrollView>
                      ) : null}
                    </View>
                  );
                })}
                <PagedMore
                  hasMore={paged.hasMore}
                  remaining={paged.remaining}
                  onMore={paged.more}
                />
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(cancelOrderId)}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelOrderId(null)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCancelOrderId(null)}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.sheet,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <Text style={[styles.title, { color: c.text, fontSize: 18 }]}>
              Annuler la commande
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 8 }}>
              Le client sera remboursé et recevra un message d’excuse.
            </Text>
            <View style={styles.actions}>
              {CANCEL_REASON_CODES.map((code) => {
                const on = cancelReason === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setCancelReason(code)}
                    style={[
                      styles.chip,
                      on
                        ? { backgroundColor: c.primary }
                        : { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? c.primaryForeground : c.textMuted,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {CANCEL_REASONS[code].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={cancelNote}
              onChangeText={setCancelNote}
              placeholder="Précision optionnelle"
              placeholderTextColor={c.textMuted}
              multiline
              style={[
                styles.input,
                styles.area,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setCancelOrderId(null)}
                style={[styles.chip, { flex: 1, borderColor: HAIRLINE, minHeight: 44 }]}
              >
                <Text style={{ color: c.text, fontWeight: "700" }}>Retour</Text>
              </Pressable>
              <Pressable
                disabled={cancelBusy}
                onPress={() => void vendorCancel()}
                style={[
                  styles.primary,
                  { flex: 1, backgroundColor: "#FF453A" },
                ]}
              >
                <Text style={[styles.primaryText, { color: "#fff" }]}>
                  {cancelBusy ? "…" : "Annuler & rembourser"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 12, marginTop: 4 },
  scanCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  area: { minHeight: 80, textAlignVertical: "top", marginVertical: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 10,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { fontWeight: "800" },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
});
