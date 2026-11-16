import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeBack } from "@/src/nav";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, apiPayment } from "@/src/api";
import { formatMoney } from "@/src/format";
import {
    clearPaymentIdempotencyKey,
    paymentIdempotencyKey,
} from "@/src/pay-idempotency";
import { composePhone, isValidContactPhone, splitPhone } from "@/src/phone";
import { APP_CURRENCIES, type AppCurrency } from "@/src/product-options";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import {
    RAIL_PROVIDERS,
    WALLET_BUCKETS,
    bucketLabel,
    emptyPots,
    parseWalletCurrency,
    providerLabel,
    txnLabel,
    walletCents,
    withdrawFeePct,
    type PayResult,
    type RailProvider,
    type WalletBalances,
    type WalletBucket,
    type WalletPots,
    type WalletTxn,
} from "@/src/wallet";

type WalletPayload = {
  wallet?: WalletBalances;
  pots?: Record<string, WalletPots>;
  displayCurrency?: string;
  transactions?: WalletTxn[];
  contacts?: { provider: RailProvider; phone: string }[];
  accountPhone?: string | null;
};

export function WalletScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const walletQuery = useQuery({
    queryKey: ["wallet", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<WalletPayload>("/api/wallet"),
  });

  const wallet = walletQuery.data?.wallet;
  const displayCurrency = parseWalletCurrency(
    walletQuery.data?.displayCurrency ?? wallet?.currency,
  );
  const pots =
    walletQuery.data?.pots?.[displayCurrency] ??
    walletQuery.data?.pots?.USD ??
    emptyPots();
  const txns = walletQuery.data?.transactions ?? [];
  const contactsFromApi = useMemo(() => {
    const next: Record<RailProvider, string> = {
      MPESA: "",
      ORANGE: "",
      AIRTEL: "",
    };
    for (const row of walletQuery.data?.contacts ?? []) {
      if (row.provider in next) next[row.provider] = row.phone;
    }
    const account = walletQuery.data?.accountPhone ?? "";
    if (account && !next.MPESA && !next.ORANGE && !next.AIRTEL) {
      next.MPESA = account;
    }
    return next;
  }, [walletQuery.data]);
  const [phoneOverride, setPhoneOverride] = useState<Record<
    RailProvider,
    string
  > | null>(null);
  const phones = phoneOverride ?? contactsFromApi;
  const [provider, setProvider] = useState<RailProvider>("MPESA");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [bucket, setBucket] = useState<WalletBucket>("BUYER");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ussdHint, setUssdHint] = useState<string | null>(null);

  const payIntent = useMemo(
    () => `deposit:${amount}:${currency}:${provider}`,
    [amount, currency, provider],
  );

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ["wallet", token ?? "guest"],
    });
    await walletQuery.refetch();
  }

  async function saveContacts() {
    try {
      await api("/api/wallet/contacts", {
        method: "PUT",
        body: JSON.stringify({
          contacts: RAIL_PROVIDERS.filter((id) => phones[id].trim()).map(
            (id) => {
              const parts = splitPhone(phones[id]);
              return {
                provider: id,
                phone: composePhone(parts.country.dial, parts.national),
              };
            },
          ),
        }),
      });
      showToast("Numéros enregistrés", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    }
  }

  async function applyResult(json: PayResult, mode: "initiate" | "done") {
    if (json.status === "EXPIRED" || json.status === "REJECTED") {
      showToast("Paiement expiré ou refusé", "error");
      setPendingId(null);
      setUssdHint(null);
      await clearPaymentIdempotencyKey(payIntent);
      await refresh();
      return;
    }
    if (mode === "initiate" && json.paymentUrl) {
      setPendingId(json.transactionId ?? null);
      const result = await WebBrowser.openBrowserAsync(json.paymentUrl);
      if (result.type === "dismiss" || result.type === "cancel") {
        await confirmDeposit(json.transactionId ?? pendingId);
        return;
      }
      await confirmDeposit(json.transactionId ?? null);
      return;
    }
    if (mode === "initiate" && json.status && json.status !== "POSTED") {
      setPendingId(json.transactionId ?? null);
      setUssdHint(json.ussdHint ?? null);
      showToast(
        json.ussdHint?.trim() || "Confirme le paiement CinetPay",
        "info",
      );
      return;
    }
    if (
      json.status === "POSTED" ||
      json.alreadyApplied ||
      json.alreadyConfirmed
    ) {
      showToast("Compte rechargé", "success");
      setPendingId(null);
      setUssdHint(null);
      await clearPaymentIdempotencyKey(payIntent);
      await refresh();
    }
  }

  async function confirmDeposit(transactionId: string | null) {
    const txnId = transactionId ?? pendingId;
    if (!txnId) {
      await refresh();
      return;
    }
    try {
      const json = await apiPayment<PayResult>("/api/wallet/deposit", {
        method: "POST",
        idempotencyKey: await paymentIdempotencyKey(payIntent),
        body: JSON.stringify({ action: "confirm", transactionId: txnId }),
      });
      await applyResult(json, "done");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Confirmation impossible",
        "error",
      );
      await refresh();
    }
  }

  async function deposit() {
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      showToast("Montant invalide", "error");
      return;
    }
    const parts = splitPhone(phones[provider]);
    const e164 = composePhone(parts.country.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      showToast("Enregistre un numéro Mobile Money", "error");
      return;
    }
    setBusy(true);
    try {
      const key = await paymentIdempotencyKey(payIntent);
      const json = await apiPayment<PayResult>("/api/wallet/deposit", {
        method: "POST",
        idempotencyKey: key,
        body: JSON.stringify({
          action: "initiate",
          provider,
          phone: e164,
          amountCents: cents,
          currency,
          idempotencyKey: key,
        }),
      });
      await applyResult(json, "initiate");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Recharge impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    const phone =
      phones[provider] || Object.values(phones).find((value) => value.trim());
    if (!phone) {
      showToast("Choisis un réseau et un numéro", "error");
      return;
    }
    const gross = pots[bucket];
    if (gross <= 0) {
      showToast("Ce pot est vide", "error");
      return;
    }
    const parts = splitPhone(phone);
    const e164 = composePhone(parts.country.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      showToast("Numéro Mobile Money invalide", "error");
      return;
    }
    setBusy(true);
    const feePct = withdrawFeePct(bucket);
    const fee = Math.floor((gross * feePct) / 100);
    const intent = `withdraw:${bucket}:${gross}:${displayCurrency}`;
    try {
      const key = await paymentIdempotencyKey(intent);
      await apiPayment("/api/wallet/withdraw", {
        method: "POST",
        idempotencyKey: key,
        replayScope: "WITHDRAW",
        body: JSON.stringify({
          bucket,
          amountCents: gross,
          currency: displayCurrency,
          provider,
          phone: e164,
          idempotencyKey: key,
        }),
      });
      await clearPaymentIdempotencyKey(intent);
      showToast(
        `Retrait ${formatMoney(gross - fee, displayCurrency)} (frais ${formatMoney(fee, displayCurrency)})`,
        "success",
      );
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Retrait impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 20,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color="#fff" />
        <Text style={styles.backText} numberOfLines={1}>
          Retour{"\u00A0"}
        </Text>
      </Pressable>
      <Text style={styles.title}>Portefeuille</Text>
      {!token ? (
        <Pressable style={styles.primary} onPress={openAuth}>
          <Text style={styles.primaryText}>Se connecter</Text>
        </Pressable>
      ) : walletQuery.isLoading ? (
        <ActivityIndicator color={colors.emerald} />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={styles.kicker}>Solde ShipShop</Text>
            <Text style={styles.balance}>
              {formatMoney(
                walletCents(wallet, displayCurrency),
                displayCurrency,
              )}
            </Text>
            <View style={styles.rowWrap}>
              {APP_CURRENCIES.map((code) => (
                <View key={code} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {formatMoney(walletCents(wallet, code), code)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.hint}>
              Achats = solde interne. CinetPay sert à recharger et retirer.
            </Text>
            <View style={styles.pots}>
              {WALLET_BUCKETS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setBucket(item)}
                  style={[styles.pot, bucket === item && styles.potOn]}
                >
                  <Text style={styles.potLabel}>{bucketLabel(item)}</Text>
                  <Text style={styles.potValue}>
                    {formatMoney(pots[item], displayCurrency)}
                  </Text>
                  <Text style={styles.potFee}>
                    retrait {withdrawFeePct(item)} %
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.withdraw, busy && { opacity: 0.6 }]}
              disabled={busy || pots[bucket] <= 0}
              onPress={() => void withdraw()}
            >
              <Text style={styles.withdrawText}>
                Retirer le pot {bucketLabel(bucket).toLowerCase()}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Recharger avec CinetPay</Text>
          <View style={styles.rowWrap}>
            {RAIL_PROVIDERS.map((id) => (
              <Pressable
                key={id}
                onPress={() => setProvider(id)}
                style={[styles.rail, provider === id && styles.railOn]}
              >
                <Text
                  style={[
                    styles.railText,
                    provider === id && styles.railTextOn,
                  ]}
                >
                  {providerLabel(id)}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={phones[provider]}
            onChangeText={(value) =>
              setPhoneOverride({ ...phones, [provider]: value })
            }
            placeholder="+243…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <View style={styles.amountRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1 }]}
            />
            {APP_CURRENCIES.filter((code) => code !== "KW").map((code) => (
              <Pressable
                key={code}
                onPress={() => setCurrency(code)}
                style={[styles.rail, currency === code && styles.railOn]}
              >
                <Text
                  style={[
                    styles.railText,
                    currency === code && styles.railTextOn,
                  ]}
                >
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>
          {ussdHint ? <Text style={styles.ussd}>{ussdHint}</Text> : null}
          <Pressable
            style={[styles.primary, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => void deposit()}
          >
            <Text style={styles.primaryText}>
              {busy ? "CinetPay…" : "Payer avec CinetPay"}
            </Text>
          </Pressable>
          {pendingId ? (
            <Pressable onPress={() => void confirmDeposit(pendingId)}>
              <Text style={styles.link}>J’ai payé — vérifier</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void saveContacts()}>
            <Text style={styles.link}>Enregistrer ce numéro</Text>
          </Pressable>

          <Text style={styles.section}>Mouvements</Text>
          {txns.length === 0 ? (
            <Text style={styles.hint}>Aucun mouvement pour l’instant.</Text>
          ) : (
            txns.slice(0, 20).map((row) => (
              <View key={row.id} style={styles.txn}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{txnLabel(row.type)}</Text>
                  <Text style={styles.txnMeta}>
                    {providerLabel(row.provider)} · {row.status}
                  </Text>
                </View>
                <Text style={styles.txnAmount}>
                  {formatMoney(
                    row.amountCents,
                    row.currency ?? displayCurrency,
                  )}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
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
  card: { borderRadius: 24, padding: 18, gap: 10 },
  kicker: { color: colors.muted, fontWeight: "700" },
  balance: { color: colors.emerald, fontSize: 34, fontWeight: "800" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  pots: { flexDirection: "row", gap: 8 },
  pot: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 8,
    alignItems: "center",
    gap: 2,
  },
  potOn: { borderColor: "#FF7A00", backgroundColor: "rgba(255,122,0,0.12)" },
  potLabel: { color: colors.muted, fontSize: 10 },
  potValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
  },
  potFee: { color: "#fcd34d", fontSize: 9 },
  withdraw: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  withdrawText: { color: "#04281c", fontWeight: "800" },
  section: { color: "#fff", fontWeight: "800", marginTop: 6 },
  rail: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  railOn: { backgroundColor: "#FF7A00" },
  railText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  railTextOn: { color: "#fff" },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ussd: { color: colors.emerald, fontSize: 12 },
  primary: {
    backgroundColor: "#FF7A00",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  link: { color: colors.emerald, fontWeight: "700" },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  txnTitle: { color: "#fff", fontWeight: "700" },
  txnMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  txnAmount: { color: colors.emerald, fontWeight: "800" },
});
