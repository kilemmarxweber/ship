import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParcelMap } from "@/components/orders/ParcelMap";
import { api, ApiError, apiPayment, mediaUrl } from "@/src/api";
import {
    countries,
    defaultCountry,
    digitsOnly,
    type CountryDial,
} from "@/src/countries";
import { formatMoney } from "@/src/format";
import { getDeviceCoords } from "@/src/geo";
import { useMe } from "@/src/me";
import { checkoutPath, type CheckoutResult } from "@/src/orders";
import {
    clearPaymentIdempotencyKey,
    paymentIdempotencyKey,
} from "@/src/pay-idempotency";
import { composePhone, splitPhone } from "@/src/phone";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import {
    reloadWantedRequest,
    useWantedDetail,
    WANTED_NO_TRACE,
    type WantedCheckoutResult,
    type WantedOffer,
} from "@/src/wanted";

type Intent = "PICKUP" | "DELIVERY" | "SELLER_DROP";
type Rail = "SHIPSHOP" | "OFF_PLATFORM";

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

function offerStatusLabel(status: string) {
  if (status === "ACCEPTED") return "Acceptée";
  if (status === "DECLINED") return "Refusée";
  return "En attente";
}

export function WantedDetailScreen({ requestId }: { requestId: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const detail = useWantedDetail(requestId);
  const request = detail.data?.request;
  const isOwner = Boolean(
    request?.isOwner || (me.data?.id && request?.buyer?.id === me.data.id),
  );

  const [offer, setOffer] = useState<WantedOffer | null>(null);
  const [intent, setIntent] = useState<Intent>("PICKUP");
  const [rail, setRail] = useState<Rail>("SHIPSHOP");
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(defaultCountry);
  const [national, setNational] = useState("");
  const [pickingCountry, setPickingCountry] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [city, setCity] = useState("Kinshasa");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [avenue, setAvenue] = useState("");
  const [parcelle, setParcelle] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [shippingCents, setShippingCents] = useState(0);

  useEffect(() => {
    if (!token) return;
    void api<{ user?: { phone?: string | null } }>("/api/profile")
      .then((data) => {
        const phone = data.user?.phone?.trim();
        if (!phone) return;
        const parts = splitPhone(phone);
        setCountry(parts.country);
        setNational((current) =>
          digitsOnly(current || parts.national).slice(0, parts.country.max),
        );
      })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (intent !== "DELIVERY" || !offer?.shop?.id || !city.trim()) {
      setShippingCents(0);
      return;
    }
    const timer = setTimeout(() => {
      void api<{ quote?: { shippingCents: number } }>("/api/shipping/quote", {
        method: "POST",
        body: JSON.stringify({
          shopId: offer.shop?.id,
          city: city.trim(),
          commune: commune.trim() || null,
          lat: deliveryLat,
          lng: deliveryLng,
        }),
      })
        .then((data) => setShippingCents(data.quote?.shippingCents ?? 0))
        .catch(() => setShippingCents(0));
    }, 450);
    return () => clearTimeout(timer);
  }, [intent, offer?.shop?.id, city, commune, deliveryLat, deliveryLng]);

  const filteredCountries = useMemo(() => {
    const needle = countryQuery.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.dial.includes(needle) ||
        item.iso.toLowerCase().includes(needle),
    );
  }, [countryQuery]);

  function onNationalChange(value: string) {
    setNational(digitsOnly(value).slice(0, country.max));
  }

  function pickCountry(next: CountryDial) {
    setCountry(next);
    setNational((current) => digitsOnly(current).slice(0, next.max));
    setPickingCountry(false);
    setCountryQuery("");
  }

  async function pinGps() {
    try {
      const point = await getDeviceCoords();
      setDeliveryLat(point.latitude);
      setDeliveryLng(point.longitude);
    } catch {
      showToast("Position indisponible", "error");
    }
  }

  async function checkout() {
    if (!offer) return;
    if (!token) {
      openAuth();
      return;
    }
    if (rail === "OFF_PLATFORM" && !waiver) {
      showToast(WANTED_NO_TRACE, "error");
      return;
    }
    const local = digitsOnly(national);
    if (
      rail === "SHIPSHOP" &&
      (local.length < country.min || local.length > country.max)
    ) {
      showToast(
        `Le numéro ${country.name} doit avoir ${country.min}${
          country.min === country.max ? "" : ` à ${country.max}`
        } chiffre${country.max > 1 ? "s" : ""}.`,
        "error",
      );
      return;
    }
    const contactPhone = composePhone(country.dial, local);
    setBusy(true);
    const intentKey = `wanted:${requestId}:${offer.id}`;
    try {
      const idempotencyKey = await paymentIdempotencyKey(intentKey);
      const paid = await apiPayment<WantedCheckoutResult>(
        `/api/wanted/${requestId}/offers/${offer.id}/checkout`,
        {
          method: "POST",
          idempotencyKey,
          replayScope: "CHECKOUT",
          body: JSON.stringify({
            paymentRail: rail,
            fulfillmentType: intent,
            waiver: rail === "OFF_PLATFORM" ? true : undefined,
            deliveryCity: city.trim() || null,
            deliveryAddress:
              composeAddress({ city, commune, quartier, avenue, parcelle }) ||
              null,
            deliveryCommune: commune.trim() || null,
            deliveryQuartier: quartier.trim() || null,
            deliveryAvenue: avenue.trim() || null,
            deliveryParcelle: parcelle.trim() || null,
            deliveryLat,
            deliveryLng,
            contactPhone: rail === "SHIPSHOP" ? contactPhone : undefined,
            idempotencyKey,
          }),
        },
      );
      await clearPaymentIdempotencyKey(intentKey);
      await reloadWantedRequest(queryClient, requestId);
      setOffer(null);
      if (paid.paymentRail === "OFF_PLATFORM") {
        showToast(
          "Offre acceptée hors ShipShop — pas de remboursement.",
          "info",
        );
        return;
      }
      const paidText =
        intent === "DELIVERY"
          ? "Payé — suis le colis et présente le QR à la remise."
          : intent === "SELLER_DROP"
            ? "Payé — présente le QR au vendeur à la remise."
            : "Payé — présente le QR au vendeur pour récupérer l’article.";
      showToast(paidText, "success");
      const path = checkoutPath(
        paid as CheckoutResult,
        intent === "DELIVERY" ? "DELIVERY" : "PICKUP",
      );
      router.push(path as Href);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 402) {
        showToast(cause.message, "error");
        router.push("/wallet" as Href);
      } else {
        showToast(
          cause instanceof Error ? cause.message : "Acceptation impossible",
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (detail.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.emerald} />
      </View>
    );
  }
  if (!request) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.text }}>Demande introuvable</Text>
      </View>
    );
  }

  const offers = request.offers ?? [];
  const cover = request.images[0];
  const shipping =
    rail === "SHIPSHOP" && intent === "DELIVERY" ? shippingCents : 0;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Text style={[styles.backText, { color: c.text }]}>Retour</Text>
        </Pressable>
        {cover ? (
          <Image
            source={{ uri: mediaUrl(cover) ?? cover }}
            style={styles.hero}
            contentFit="cover"
          />
        ) : null}
        <Text style={[styles.title, { color: c.text }]}>{request.title}</Text>
        <Text style={{ color: c.emerald, fontWeight: "800" }}>
          Budget {formatMoney(request.budgetCents, request.currency)}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          {request.condition === "USED" ? "Occasion" : "Neuf / magasin"}
          {request.commune ? ` · ${request.commune}` : ""}
          {request.buyer?.name ? ` · ${request.buyer.name}` : ""}
        </Text>
        {request.description ? (
          <Text style={{ color: c.text, fontSize: 14 }}>
            {request.description}
          </Text>
        ) : null}
        <Text style={[styles.section, { color: c.text }]}>Proposants</Text>
        {offers.length === 0 ? (
          <Text style={{ color: c.textMuted }}>Pas encore d’offre.</Text>
        ) : (
          offers.map((row) => (
            <View
              key={row.id}
              style={[
                styles.card,
                {
                  backgroundColor: c.card,
                  borderColor: "rgba(127,127,140,0.22)",
                },
              ]}
            >
              {row.images?.[0] ? (
                <Image
                  source={{ uri: mediaUrl(row.images[0]) ?? row.images[0] }}
                  style={styles.offerPhoto}
                  contentFit="cover"
                />
              ) : null}
              <View style={styles.offerHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.offerName, { color: c.text }]}>
                    {row.seller?.name ?? "Vendeur"}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {row.shop?.name}
                    {row.shop?.isOccasionStall ? " · occasion" : ""}
                    {row.kycApproved ? " · KYC" : ""}
                  </Text>
                </View>
                <Text
                  style={{
                    color: row.overBudget ? "#fbbf24" : c.emerald,
                    fontWeight: "800",
                  }}
                >
                  {formatMoney(row.priceCents, request.currency)}
                </Text>
              </View>
              {row.message ? (
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {row.message}
                </Text>
              ) : null}
              {isOwner && row.sellerPhone ? (
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${row.sellerPhone}`)}
                >
                  <Text style={{ color: c.emerald, fontWeight: "700" }}>
                    {row.sellerPhone}
                  </Text>
                </Pressable>
              ) : null}
              {isOwner && row.sellerAddress ? (
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {row.sellerAddress}
                </Text>
              ) : null}
              <Text style={{ color: c.textMuted, fontSize: 11 }}>
                {offerStatusLabel(row.status)}
                {row.sellerCommune ? ` · ${row.sellerCommune}` : ""}
              </Text>
              {isOwner &&
              row.status === "PENDING" &&
              request.status === "OPEN" ? (
                <Pressable onPress={() => setOffer(row)}>
                  <LinearGradient
                    colors={[colors.buyStart, colors.buyEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.acceptBtn}
                  >
                    <Text style={styles.acceptText}>Accepter</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 8 }}>
          Paiement ShipShop = traces, QR et remboursement possible. Commission 5
          % à la remise, comme en boutique. {WANTED_NO_TRACE}
        </Text>
      </ScrollView>

      <Modal visible={Boolean(offer)} animationType="slide" transparent>
        <View style={styles.modalFrame}>
          <Pressable style={styles.backdrop} onPress={() => setOffer(null)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.sheet,
                paddingBottom: Math.max(16, insets.bottom),
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              Accepter {offer?.seller?.name}
            </Text>
            <Text style={{ color: c.emerald, fontWeight: "800" }}>
              {offer ? formatMoney(offer.priceCents, request.currency) : null}
              {shipping > 0 ? ` + transport ${formatMoney(shipping)}` : ""}
            </Text>
            {(
              [
                ["PICKUP", "Je vais le chercher"],
                ["DELIVERY", "Livreur ShipShop"],
                ["SELLER_DROP", "Le vendeur apporte"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setIntent(value)}
                style={[
                  styles.choice,
                  intent === value && { borderColor: c.emerald },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: "700" }}>
                  {label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setRail("SHIPSHOP")}
              style={[
                styles.choice,
                rail === "SHIPSHOP" && { borderColor: c.emerald },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "700" }}>
                Payer sur ShipShop (QR + traces)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRail("OFF_PLATFORM")}
              style={[
                styles.choice,
                rail === "OFF_PLATFORM" && { borderColor: "#f59e0b" },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "700" }}>
                Hors ShipShop (espèces / direct)
              </Text>
            </Pressable>
            {rail === "OFF_PLATFORM" ? (
              <View style={styles.waiver}>
                <Switch value={waiver} onValueChange={setWaiver} />
                <Text style={{ color: c.textMuted, flex: 1, fontSize: 12 }}>
                  {WANTED_NO_TRACE}
                </Text>
              </View>
            ) : pickingCountry ? (
              <View style={{ gap: 8 }}>
                <View
                  style={[
                    styles.input,
                    styles.phoneField,
                    { borderColor: c.textMuted },
                  ]}
                >
                  <Ionicons name="search" size={16} color={c.textMuted} />
                  <TextInput
                    value={countryQuery}
                    onChangeText={setCountryQuery}
                    placeholder="Pays ou indicatif"
                    placeholderTextColor={c.textMuted}
                    style={[styles.phoneInput, { color: c.text }]}
                    autoFocus
                  />
                </View>
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(item) => item.iso + item.dial}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 200 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.countryRow}
                      onPress={() => pickCountry(item)}
                    >
                      <Text style={styles.flag}>{item.flag}</Text>
                      <Text style={[styles.countryName, { color: c.text }]}>
                        {item.name}
                      </Text>
                      <Text style={{ color: c.textMuted, fontWeight: "700" }}>
                        +{item.dial}
                      </Text>
                    </Pressable>
                  )}
                />
                <Pressable onPress={() => setPickingCountry(false)}>
                  <Text style={{ color: c.emerald, fontWeight: "700" }}>
                    Fermer la liste
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                <View style={styles.phoneRow}>
                  <Pressable
                    style={[styles.dialBtn, { borderColor: c.textMuted }]}
                    onPress={() => setPickingCountry(true)}
                  >
                    <Text style={styles.flag}>{country.flag}</Text>
                    <Text style={[styles.dialText, { color: c.text }]}>
                      +{country.dial}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={c.textMuted}
                    />
                  </Pressable>
                  <View
                    style={[
                      styles.input,
                      styles.phoneField,
                      { flex: 1, borderColor: c.textMuted },
                    ]}
                  >
                    <TextInput
                      value={national}
                      onChangeText={onNationalChange}
                      keyboardType="phone-pad"
                      maxLength={country.max}
                      placeholder={`${country.min} chiffres`}
                      placeholderTextColor={c.textMuted}
                      style={[styles.phoneInput, { color: c.text }]}
                    />
                  </View>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>
                  {country.name} · {country.min}
                  {country.min === country.max ? "" : `–${country.max}`}{" "}
                  chiffres après +{country.dial}
                </Text>
              </View>
            )}
            {intent === "DELIVERY" ? (
              <View style={{ gap: 8 }}>
                <Pressable onPress={() => void pinGps()} style={styles.choice}>
                  <Text style={{ color: c.text }}>Ma position GPS</Text>
                </Pressable>
                {deliveryLat != null && deliveryLng != null ? (
                  <ParcelMap
                    mode="pin"
                    courier={null}
                    destination={{ lat: deliveryLat, lng: deliveryLng }}
                    label="Livraison ici"
                  />
                ) : null}
                <TextInput
                  value={commune}
                  onChangeText={setCommune}
                  placeholder="Commune"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    { color: c.text, borderColor: c.textMuted },
                  ]}
                />
              </View>
            ) : null}
            <Pressable disabled={busy} onPress={() => void checkout()}>
              <LinearGradient
                colors={[colors.buyStart, colors.buyEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.acceptBtn}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.acceptText}>
                    {rail === "SHIPSHOP"
                      ? "Payer et confirmer"
                      : "Accepter hors piste"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backText: { fontWeight: "700" },
  hero: { width: "100%", height: 180, borderRadius: 18 },
  title: { fontSize: 22, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "800", marginTop: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  offerPhoto: { width: "100%", height: 120, borderRadius: 12 },
  offerHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  offerName: { fontWeight: "800", fontSize: 15 },
  acceptBtn: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptText: { color: "#fff", fontWeight: "800" },
  modalFrame: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  choice: {
    borderWidth: 1,
    borderColor: "rgba(127,127,140,0.35)",
    borderRadius: 14,
    padding: 12,
  },
  waiver: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  dialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  flag: { fontSize: 18 },
  dialText: { fontWeight: "700" },
  phoneField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  phoneInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  countryName: { flex: 1, fontWeight: "600" },
});
