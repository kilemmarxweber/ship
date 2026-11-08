import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParcelMap } from "@/components/orders/ParcelMap";
import { api, ApiError, apiPayment, mediaUrl } from "@/src/api";
import { groupByShop, parseCart, type CartItem } from "@/src/cart";
import { cartQueryKey, useCart } from "@/src/cart-store";
import { countries, defaultCountry, digitsOnly } from "@/src/countries";
import { formatMoney } from "@/src/format";
import {
    geoErrorCode,
    getDeviceCoords,
    openAppPermissionSettings,
    openDeviceLocationSettings,
} from "@/src/geo";
import { isOnline } from "@/src/offline/network";
import { persistCart } from "@/src/offline/persist";
import {
    clearCartLines,
    removeCartLine,
    saveCartLine,
} from "@/src/offline/writes";
import {
    checkoutPath,
    type CheckoutHref,
    type CheckoutResult,
    type FulfillmentType,
} from "@/src/orders";
import {
    clearPaymentIdempotencyKey,
    paymentIdempotencyKey,
} from "@/src/pay-idempotency";
import { useSession } from "@/src/session";
import { refreshSoldProducts } from "@/src/shelf";
import { productInStock, stockAlertColor, stockRemaining } from "@/src/stock";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

function splitPhone(phone: string) {
  const digits = digitsOnly(phone);
  const match = [...countries]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((item) => digits.startsWith(item.dial));
  if (match) {
    return { country: match, national: digits.slice(match.dial.length) };
  }
  return { country: defaultCountry, national: digits };
}

function composeAddress(parts: {
  city: string;
  commune: string;
  quartier: string;
  avenue: string;
  parcelle: string;
}) {
  return [
    parts.avenue,
    parts.parcelle,
    parts.quartier,
    parts.commune,
    parts.city,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const setCount = useCart((state) => state.setCount);
  const [busy, setBusy] = useState(false);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("PICKUP");
  const [country, setCountry] = useState(defaultCountry);
  const [national, setNational] = useState("");
  const [city, setCity] = useState("Kinshasa");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [avenue, setAvenue] = useState("");
  const [parcelle, setParcelle] = useState("");
  const [shippingQuote, setShippingQuote] = useState<{
    key: string;
    shippingCents: number;
    distanceKm: number | null;
  } | null>(null);
  const [quotingKey, setQuotingKey] = useState<string | null>(null);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  const cart = useQuery({
    queryKey: cartQueryKey(token),
    enabled: Boolean(token),
    staleTime: 45_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: async () => {
      const raw = await api<unknown>("/api/cart");
      persistCart(token, parseCart(raw));
      return raw;
    },
  });

  const payload = useMemo(
    () => parseCart(cart.data ?? { items: [], totalCents: 0, count: 0 }),
    [cart.data],
  );

  useEffect(() => {
    if (token && cart.data) setCount(payload.count);
  }, [token, cart.data, payload.count, setCount]);

  useEffect(() => {
    if (!token) return;
    void api<{ user?: { phone?: string | null } }>("/api/profile")
      .then((data) => {
        const phone = data.user?.phone?.trim();
        if (!phone) return;
        const parts = splitPhone(phone);
        setCountry(parts.country);
        setNational((current) => current || parts.national);
      })
      .catch(() => undefined);
  }, [token]);

  const groups = groupByShop(payload.items);
  const shopId = groups[0]?.[0] ?? "";
  const currency = payload.items[0]?.product.currency ?? "USD";
  const quoteKey =
    fulfillmentType === "DELIVERY" && shopId && city.trim()
      ? JSON.stringify([
          shopId,
          city.trim(),
          commune.trim(),
          deliveryLat,
          deliveryLng,
        ])
      : null;
  const currentQuote =
    quoteKey && shippingQuote?.key === quoteKey ? shippingQuote : null;
  const shippingCents = currentQuote?.shippingCents ?? 0;
  const distanceKm = currentQuote?.distanceKm ?? null;
  const quoting = quoteKey !== null && quotingKey === quoteKey;
  const payable =
    payload.totalCents + (fulfillmentType === "DELIVERY" ? shippingCents : 0);
  const filledCart = Boolean(token) && payload.items.length > 0;
  const blockedStock = payload.items.some(
    (item) => !productInStock(item.product),
  );

  useEffect(() => {
    if (!quoteKey) return;
    const key = quoteKey;
    const timer = setTimeout(() => {
      setQuotingKey(key);
      void api<{
        quote?: { shippingCents: number; distanceKm: number };
      }>("/api/shipping/quote", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          city: city.trim(),
          commune: commune.trim() || null,
          lat: deliveryLat,
          lng: deliveryLng,
        }),
      })
        .then((data) => {
          setShippingQuote({
            key,
            shippingCents: data.quote?.shippingCents ?? 0,
            distanceKm: data.quote?.distanceKm ?? null,
          });
        })
        .catch(() => {
          setShippingQuote({ key, shippingCents: 0, distanceKm: null });
        })
        .finally(() => {
          setQuotingKey((current) => (current === key ? null : current));
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [quoteKey, shopId, city, commune, deliveryLat, deliveryLng]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      void queryClient.refetchQueries({ queryKey: cartQueryKey(token) });
    }, [token, queryClient]),
  );

  async function setQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      await removeItem(productId);
      return;
    }
    setBusy(true);
    try {
      await saveCartLine(queryClient, token, { productId, quantity });
      setCount(
        parseCart(queryClient.getQueryData(cartQueryKey(token)) ?? {}).count,
      );
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Quantité impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(productId: string) {
    setBusy(true);
    try {
      await removeCartLine(queryClient, token, productId);
      showToast("Retiré du panier", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelCart() {
    setBusy(true);
    try {
      await clearCartLines(queryClient, token);
      showToast("Panier annulé", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Annulation impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function captureGps() {
    setLocating(true);
    try {
      const position = await getDeviceCoords();
      const lat = position.latitude;
      const lng = position.longitude;
      const accuracy = position.accuracy;
      setDeliveryLat(lat);
      setDeliveryLng(lng);
      setAccuracyM(
        Number.isFinite(accuracy) && accuracy && accuracy > 0 ? accuracy : null,
      );
      try {
        const geo = await api<{
          city?: string;
          commune?: string;
          quartier?: string;
          avenue?: string;
          houseNumber?: string;
        }>(
          `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        );
        if (geo.city?.trim()) setCity(geo.city.trim());
        if (geo.commune?.trim()) setCommune(geo.commune.trim());
        if (geo.quartier?.trim()) setQuartier(geo.quartier.trim());
        if (geo.avenue?.trim()) setAvenue(geo.avenue.trim());
        if (geo.houseNumber?.trim()) setParcelle(geo.houseNumber.trim());
        showToast(
          accuracy
            ? `Position précise (~${Math.round(accuracy)} m)`
            : "Position enregistrée",
          "success",
        );
      } catch {
        showToast(
          "Position GPS OK — complète commune / quartier à la main",
          "info",
        );
      }
    } catch (cause) {
      const code = geoErrorCode(cause);
      if (code === "permission") {
        Alert.alert(
          "Autorisation requise",
          "ShipShop n’a pas encore l’accès à ta position. Autorise la localisation pour cette application.",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Autoriser dans Réglages",
              onPress: () => void openAppPermissionSettings(),
            },
          ],
        );
      } else if (code === "services") {
        Alert.alert(
          "Localisation désactivée",
          "Le GPS du téléphone est éteint. Active-le puis appuie encore sur Ma position.",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Ouvrir la localisation",
              onPress: () => void openDeviceLocationSettings(),
            },
          ],
        );
      } else {
        showToast(
          "Position introuvable. Réessaie dans quelques secondes.",
          "error",
        );
      }
    } finally {
      setLocating(false);
    }
  }

  async function openPaid(result?: CheckoutResult | null) {
    let path: CheckoutHref = result
      ? checkoutPath(result, fulfillmentType)
      : "/orders/index";
    if (path === "/orders/index") {
      try {
        const latest = await api<{
          orders?: {
            id: string;
            fulfillmentType?: string;
            handover?: { id: string } | null;
          }[];
        }>("/api/orders?status=active");
        const first = latest.orders?.[0];
        if (first?.fulfillmentType === "DELIVERY" && first.id) {
          path = { pathname: "/orders/[id]", params: { id: first.id } };
        } else if (first?.handover?.id) {
          path = {
            pathname: "/orders/ticket/[id]",
            params: { id: first.handover.id },
          };
        } else if (first?.id) {
          path = { pathname: "/orders/[id]", params: { id: first.id } };
        }
      } catch {
        path = "/orders/index";
      }
    }
    showToast(
      fulfillmentType === "PICKUP"
        ? "Payé — présente le QR en boutique"
        : "Payé — suis le colis et le QR de remise",
      "success",
    );
    router.push(path);
  }

  async function pay() {
    if (!(await isOnline())) {
      showToast("Paiement indisponible hors-ligne", "info");
      return;
    }
    if (national.length < country.min || national.length > country.max) {
      showToast(
        "Indique un téléphone de contact avec l’indicatif pays",
        "error",
      );
      return;
    }
    if (fulfillmentType === "DELIVERY" && !city.trim()) {
      showToast("Ville de livraison obligatoire", "error");
      return;
    }
    if (payload.items.some((item) => !productInStock(item.product))) {
      showToast("Retire les produits en rupture avant de payer", "error");
      return;
    }
    const intent = "checkout";
    const idempotencyKey = await paymentIdempotencyKey(intent);
    const hadItems = payload.items.length > 0;
    const soldLines = payload.items.map((item) => ({
      id: item.productId,
      quantity: item.quantity,
    }));
    setBusy(true);
    try {
      const paid = await apiPayment<CheckoutResult>("/api/cart/checkout", {
        method: "POST",
        idempotencyKey,
        replayScope: "CHECKOUT",
        body: JSON.stringify({
          fulfillmentType,
          deliveryCity: city.trim() || null,
          deliveryAddress:
            composeAddress({
              city,
              commune,
              quartier,
              avenue,
              parcelle,
            }) || null,
          deliveryCommune: commune.trim() || null,
          deliveryQuartier: quartier.trim() || null,
          deliveryAvenue: avenue.trim() || null,
          deliveryParcelle: parcelle.trim() || null,
          deliveryLat:
            typeof deliveryLat === "number" && Number.isFinite(deliveryLat)
              ? deliveryLat
              : null,
          deliveryLng:
            typeof deliveryLng === "number" && Number.isFinite(deliveryLng)
              ? deliveryLng
              : null,
          contactPhone: `+${country.dial}${digitsOnly(national)}`,
          idempotencyKey,
        }),
      });
      await clearPaymentIdempotencyKey(intent);
      setCount(0);
      await cart.refetch();
      void refreshSoldProducts(queryClient, soldLines);
      await openPaid(paid);
    } catch (cause) {
      const refreshed = await cart.refetch();
      const next = parseCart(
        refreshed.data ?? { items: [], totalCents: 0, count: 0 },
      );
      const cleared =
        hadItems &&
        (next.items.length === 0 ||
          (cause instanceof ApiError &&
            /déjà enregistré|déjà en cours|panier vide/i.test(cause.message)));
      if (cleared) {
        await clearPaymentIdempotencyKey(intent);
        setCount(0);
        await cart.refetch();
        void refreshSoldProducts(queryClient, soldLines);
        await openPaid();
      } else if (cause instanceof ApiError && cause.status === 402) {
        const needed =
          typeof cause.body.needed === "number" ? cause.body.needed : payable;
        const balance =
          typeof cause.body.balance === "number" ? cause.body.balance : 0;
        showToast(
          `${cause.message} · à payer ${formatMoney(needed, currency)} · solde ${formatMoney(balance, currency)}`,
          "error",
        );
      } else {
        showToast(
          cause instanceof Error ? cause.message : "Paiement impossible",
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const dockPad = Math.max(10, insets.bottom) + 72;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 12,
          paddingBottom: filledCart ? 0 : insets.bottom + 78,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Panier</Text>
        {payload.count > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{payload.count}</Text>
          </View>
        ) : null}
      </View>

      {!token ? (
        <View style={styles.guestCenter}>
          <Ionicons name="cart-outline" size={40} color={colors.muted} />
          <Text style={styles.guestText}>Connecte-toi pour voir ton sac.</Text>
          <Pressable style={styles.guestButton} onPress={openAuth}>
            <Text style={styles.buttonText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : cart.isLoading && payload.items.length === 0 ? (
        <ActivityIndicator color={colors.emerald} style={{ marginTop: 40 }} />
      ) : cart.isError && payload.items.length === 0 ? (
        <Text style={styles.text}>
          {cart.error instanceof Error
            ? cart.error.message
            : "Panier indisponible"}
        </Text>
      ) : payload.items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bag-outline" size={36} color={colors.muted} />
          <Text style={styles.text}>
            Ton sac est vide. Ajoute un produit depuis Pour toi.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
          >
            {groups.map(([id, items]) => (
              <View key={id} style={styles.shopBlock}>
                <Text style={styles.shopName}>
                  {items[0]?.product.shop.name}
                </Text>
                {items.map((item) => (
                  <CartRow
                    key={item.id}
                    item={item}
                    disabled={busy}
                    onMinus={() =>
                      void setQuantity(item.productId, item.quantity - 1)
                    }
                    onPlus={() =>
                      void setQuantity(item.productId, item.quantity + 1)
                    }
                    onRemove={() => void removeItem(item.productId)}
                  />
                ))}
              </View>
            ))}

            <Pressable
              disabled={busy}
              onPress={() => void cancelCart()}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Vider le panier</Text>
            </Pressable>

            <Text style={styles.section}>Retrait ou livraison</Text>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setFulfillmentType("PICKUP")}
                style={[
                  styles.mode,
                  styles.modePickup,
                  fulfillmentType === "PICKUP" && styles.modeOn,
                ]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={fulfillmentType === "PICKUP" ? "#fff" : "#fff"}
                />
                <Text
                  style={[
                    styles.modeText,
                    fulfillmentType === "PICKUP" && styles.modeTextOn,
                  ]}
                  numberOfLines={2}
                >
                  Payer en boutique
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFulfillmentType("DELIVERY")}
                style={[
                  styles.mode,
                  styles.modeDelivery,
                  fulfillmentType === "DELIVERY" && styles.modeOn,
                ]}
              >
                <Ionicons name="bicycle-outline" size={18} color="#fff" />
                <Text
                  style={[
                    styles.modeText,
                    fulfillmentType === "DELIVERY" && styles.modeTextOn,
                  ]}
                  numberOfLines={1}
                >
                  Livraison
                </Text>
              </Pressable>
            </View>

            {fulfillmentType === "PICKUP" ? (
              <Text style={styles.hint}>
                Transport 0$ — un reçu virtuel sera généré pour retirer le colis
                en boutique.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={() => void captureGps()}
                  disabled={locating}
                  style={styles.gpsBtn}
                >
                  {locating ? (
                    <ActivityIndicator color="#04281c" />
                  ) : (
                    <Ionicons name="locate" size={18} color="#04281c" />
                  )}
                  <Text style={styles.gpsText} numberOfLines={1}>
                    {locating ? "GPS…" : "Ma position"}
                  </Text>
                </Pressable>
                {deliveryLat != null && deliveryLng != null ? (
                  <View style={{ gap: 8 }}>
                    <ParcelMap
                      mode="pin"
                      courier={null}
                      destination={{ lat: deliveryLat, lng: deliveryLng }}
                      label={
                        accuracyM != null
                          ? `Tu es ici · ~${Math.round(accuracyM)} m`
                          : "Tu es ici"
                      }
                    />
                    <Text style={styles.hint}>
                      Point GPS {deliveryLat.toFixed(6)},{" "}
                      {deliveryLng.toFixed(6)}
                      {accuracyM != null
                        ? ` · précision ~${Math.round(accuracyM)} m`
                        : ""}
                    </Text>
                  </View>
                ) : null}
                <Field
                  label="Commune"
                  value={commune}
                  onChange={setCommune}
                  placeholder="Gombe"
                />
                <Field
                  label="Quartier"
                  value={quartier}
                  onChange={setQuartier}
                />
                <Field label="Avenue" value={avenue} onChange={setAvenue} />
                <Field
                  label="Parcelle / n°"
                  value={parcelle}
                  onChange={setParcelle}
                />
              </View>
            )}

            <Text style={styles.section}>Téléphone de contact</Text>
            <View style={styles.phoneRow}>
              <View style={styles.dial}>
                <Text style={styles.dialText}>
                  {country.flag} +{country.dial}
                </Text>
              </View>
              <TextInput
                value={national}
                onChangeText={(value) =>
                  setNational(digitsOnly(value).slice(0, country.max))
                }
                keyboardType="phone-pad"
                placeholder="Numéro"
                placeholderTextColor="#8d8d98"
                style={styles.phoneInput}
                maxLength={country.max}
              />
            </View>
          </ScrollView>
          <View style={[styles.dock, { paddingBottom: dockPad }]}>
            <View style={styles.totals}>
              <SummaryRow
                label="Articles"
                value={`${payload.count} · ${formatMoney(payload.totalCents, currency)}`}
              />
              <SummaryRow
                label="Transport"
                value={
                  quoting
                    ? "Calcul…"
                    : `${formatMoney(
                        fulfillmentType === "DELIVERY" ? shippingCents : 0,
                        currency,
                      )}${distanceKm != null ? ` · ${distanceKm} km` : ""}`
                }
              />
              <SummaryRow
                label="Total à payer"
                value={formatMoney(payable, currency)}
                strong
              />
            </View>
            <Pressable
              disabled={busy || blockedStock}
              onPress={() => void pay()}
              style={busy || blockedStock ? { opacity: 0.7 } : undefined}
            >
              <LinearGradient
                colors={[colors.buyStart, colors.buyEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pay}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cart" size={18} color="#fff" />
                    <Text style={styles.payText} numberOfLines={2}>
                      {blockedStock
                        ? "Retire les ruptures de stock"
                        : fulfillmentType === "PICKUP"
                          ? `Payer en boutique · ${formatMoney(payable, currency)}`
                          : `Payer livraison · ${formatMoney(payable, currency)}`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function CartRow({
  item,
  disabled,
  onMinus,
  onPlus,
  onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
}) {
  const image = mediaUrl(item.product.images[0]);
  const remaining = stockRemaining(item.product);
  const inStock = productInStock(item.product);
  return (
    <View style={styles.row}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.thumb}
          contentFit="cover"
        />
      ) : (
        <View style={styles.thumb} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={styles.lineTitle} numberOfLines={2}>
          {item.product.title}
        </Text>
        <Text
          style={[styles.meta, !inStock && styles.stockGone]}
          numberOfLines={1}
        >
          {formatMoney(item.product.priceCents, item.product.currency)}
          {inStock ? "" : " · rupture"}
        </Text>
        <View style={styles.qtyRow}>
          <Pressable
            disabled={disabled || !inStock}
            onPress={onMinus}
            style={styles.qtyBtn}
          >
            <Ionicons name="remove" size={16} color="#fff" />
          </Pressable>
          <Text
            style={[styles.qtyFrac, { color: stockAlertColor(item.product) }]}
          >
            {`${item.quantity}/${remaining}`}
          </Text>
          <Pressable
            disabled={disabled || !inStock || item.quantity >= remaining}
            onPress={onPlus}
            style={styles.qtyBtn}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={onRemove}
            style={styles.trash}
          >
            <Ionicons name="trash-outline" size={16} color="#ff8a8a" />
          </Pressable>
        </View>
      </View>
      <Text style={styles.lineTotal}>
        {formatMoney(
          item.product.priceCents * item.quantity,
          item.product.currency,
        )}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8d8d98"
        style={styles.field}
      />
    </View>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>
        {label}
      </Text>
      <Text style={[styles.totalValue, strong && styles.totalStrong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  countPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  center: { gap: 12, marginTop: 24 },
  guestCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 28,
  },
  guestText: {
    color: "rgba(255,255,255,0.72)",
    lineHeight: 22,
    textAlign: "center",
    fontSize: 15,
  },
  guestButton: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  text: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: { color: "#04281c", fontWeight: "800" },
  list: { gap: 14, paddingBottom: 20 },
  dock: {
    paddingTop: 10,
    paddingHorizontal: 0,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: colors.background,
  },
  shopBlock: { gap: 10 },
  shopName: { color: colors.emerald, fontWeight: "800", fontSize: 13 },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    alignItems: "flex-start",
  },
  thumb: { width: 72, height: 88, borderRadius: 10, backgroundColor: "#222" },
  lineTitle: { color: "#fff", fontWeight: "700" },
  meta: { color: colors.emerald, fontWeight: "700" },
  qtyFrac: {
    fontWeight: "800",
    fontSize: 16,
    minWidth: 44,
    textAlign: "center",
    flexShrink: 0,
  },
  stockGone: { color: "#ff8a8a" },
  lineTotal: { color: "#fff", fontWeight: "800", fontSize: 12, marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trash: { marginLeft: 4, padding: 6 },
  cancel: { alignSelf: "flex-start" },
  cancelText: { color: "#ff8a8a", fontWeight: "700" },
  section: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 6,
  },
  modeRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  mode: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: "visible",
  },
  modePickup: { flex: 1.4 },
  modeDelivery: { flex: 1 },
  modeOn: { backgroundColor: colors.buyStart, borderColor: colors.buyStart },
  modeText: {
    alignSelf: "stretch",
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
    includeFontPadding: false,
  },
  modeTextOn: { color: "#fff" },
  hint: { color: colors.emerald, lineHeight: 20, fontSize: 13 },
  gpsBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    paddingHorizontal: 16,
  },
  gpsText: {
    color: "#04281c",
    fontWeight: "800",
    fontSize: 15,
    flexShrink: 0,
  },
  phoneRow: { flexDirection: "row", gap: 8 },
  dial: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  dialText: { color: "#fff", fontWeight: "700" },
  phoneInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    paddingHorizontal: 12,
    fontSize: 16,
  },
  fieldLabel: { color: colors.muted, marginBottom: 4, fontSize: 12 },
  field: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    paddingHorizontal: 12,
  },
  totals: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.28)",
    padding: 14,
    gap: 8,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  totalLabel: { color: colors.muted },
  totalValue: {
    color: "#fff",
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  totalStrong: { color: "#fff", fontWeight: "800", fontSize: 16 },
  pay: {
    borderRadius: 999,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  payText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
});
