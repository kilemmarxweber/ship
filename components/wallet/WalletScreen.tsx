import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
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
import { DEFAULT_FX } from "@/src/fx";
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

function moneyCents(raw: string) {
  const value = Number.parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function minWithdrawCents(currency: string) {
  if (currency === "CDF") return DEFAULT_FX.cdfPerUsd * 100;
  return 100;
}

type WithdrawResult = {
  withdrawal?: { status?: string };
};

type Recipient = {
  id: string;
  name: string;
  shopName: string | null;
  phoneMasked: string;
};

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
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [bucket, setBucket] = useState<WalletBucket>("BUYER");
  const [payoutTo, setPayoutTo] = useState<"mine" | "other">("mine");
  const [otherPhone, setOtherPhone] = useState("");
  const [topUpFor, setTopUpFor] = useState<"me" | "someone">("me");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [payFromBalance, setPayFromBalance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ussdHint, setUssdHint] = useState<string | null>(null);

  const payIntent = useMemo(
    () =>
      `deposit:${amount}:${currency}:${payFromBalance ? "balance" : provider}:${topUpFor === "someone" ? (picked?.id ?? "") : "me"}`,
    [amount, currency, payFromBalance, picked?.id, provider, topUpFor],
  );

  useEffect(() => {
    if (topUpFor !== "someone" || picked) return;
    const q = recipientQuery.trim();
    if (q.length < 2) return;
    let cancel = false;
    const timer = setTimeout(() => {
      void api<{ recipients?: Recipient[] }>(
        `/api/wallet/recipients?q=${encodeURIComponent(q)}`,
      )
        .then((data) => {
          if (!cancel) setRecipients(data.recipients ?? []);
        })
        .catch(() => {
          if (!cancel) setRecipients([]);
        });
    }, 300);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [picked, recipientQuery, topUpFor]);

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
      showToast(
        topUpFor === "someone" ? "Recharge envoyée" : "Compte rechargé",
        "success",
      );
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
    if (topUpFor === "someone" && !picked) {
      showToast("Choisis la personne", "error");
      return;
    }
    const cents = Math.round(Number.parseFloat(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      showToast("Montant invalide", "error");
      return;
    }
    if (topUpFor === "someone" && payFromBalance) {
      setBusy(true);
      try {
        const key = await paymentIdempotencyKey(payIntent);
        await apiPayment("/api/wallet/transfer", {
          method: "POST",
          idempotencyKey: key,
          body: JSON.stringify({
            amountCents: cents,
            currency,
            beneficiaryUserId: picked?.id,
            idempotencyKey: key,
          }),
        });
        await clearPaymentIdempotencyKey(payIntent);
        showToast("Transfert effectué", "success");
        await refresh();
      } catch (cause) {
        showToast(
          cause instanceof Error ? cause.message : "Transfert impossible",
          "error",
        );
      } finally {
        setBusy(false);
      }
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
          beneficiaryUserId: topUpFor === "someone" ? picked?.id : undefined,
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

  const withdrawGross = moneyCents(withdrawAmount);
  const withdrawFee =
    withdrawGross == null
      ? 0
      : Math.floor((withdrawGross * withdrawFeePct(bucket)) / 100);
  const withdrawNet =
    withdrawGross == null ? 0 : Math.max(0, withdrawGross - withdrawFee);

  async function withdraw() {
    if (payoutTo === "other" && !otherPhone.trim()) {
      showToast("Précise le numéro du transfert", "error");
      return;
    }
    const phone =
      payoutTo === "other"
        ? otherPhone
        : phones[provider] ||
          Object.values(phones).find((value) => value.trim());
    if (!phone) {
      showToast("Choisis le réseau CinetPay et le numéro", "error");
      return;
    }
    if (displayCurrency === "KW") {
      showToast("CinetPay envoie le fond en $US ou en CDF", "error");
      return;
    }
    const available = pots[bucket];
    if (available <= 0) {
      showToast("Ce fond est vide", "error");
      return;
    }
    const gross = moneyCents(withdrawAmount);
    if (gross == null || gross <= 0) {
      showToast("Indique la somme à retirer", "error");
      return;
    }
    if (gross > available) {
      showToast("Cette somme dépasse le fond", "error");
      return;
    }
    if (gross < minWithdrawCents(displayCurrency)) {
      showToast(
        displayCurrency === "CDF" ? "Minimum 2 400 CDF" : "Minimum 1 $US",
        "error",
      );
      return;
    }
    const parts = splitPhone(phone);
    const e164 = composePhone(parts.country.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      showToast("Numéro Mobile Money invalide", "error");
      return;
    }
    setBusy(true);
    const fee = Math.floor((gross * withdrawFeePct(bucket)) / 100);
    const net = gross - fee;
    const intent = `withdraw:${bucket}:${gross}:${displayCurrency}:${e164}`;
    try {
      const key = await paymentIdempotencyKey(intent);
      const json = await apiPayment<WithdrawResult>("/api/wallet/withdraw", {
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
      const sent = formatMoney(net, displayCurrency);
      showToast(
        json.withdrawal?.status === "PENDING"
          ? payoutTo === "other"
            ? `CinetPay transfère ${sent}`
            : `CinetPay envoie ${sent}`
          : payoutTo === "other"
            ? `Transfert de ${sent} enregistré`
            : `Retrait de ${sent} enregistré`,
        "success",
      );
      setWithdrawAmount("");
      if (payoutTo === "other") setOtherPhone("");
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
      <Pressable
        accessibilityLabel="Retour"
        onPress={() => safeBack()}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={22} color="#fff" />
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
              Les achats partent du solde. CinetPay recharge le compte et envoie
              le retrait sur le numéro Mobile Money.
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
            <Text style={styles.fieldLabel}>Somme à retirer</Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
            />
            <Text style={styles.hint}>
              Disponible {formatMoney(pots[bucket], displayCurrency)}
              {withdrawGross != null && withdrawGross > 0
                ? `. Frais ${formatMoney(withdrawFee, displayCurrency)}. Tu reçois ${formatMoney(withdrawNet, displayCurrency)}.`
                : "."}{" "}
              {payoutTo === "other"
                ? "Le transfert part vers le numéro saisi plus bas."
                : "CinetPay envoie cette somme sur ton numéro."}
            </Text>
          </View>

          <Text style={styles.section}>Où envoyer le fond</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => setPayoutTo("mine")}
              style={[styles.choice, payoutTo === "mine" && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>Mon numéro</Text>
            </Pressable>
            <Pressable
              onPress={() => setPayoutTo("other")}
              style={[styles.choice, payoutTo === "other" && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>Autre numéro</Text>
            </Pressable>
          </View>
          <View style={styles.rowWrap}>
            {RAIL_PROVIDERS.map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  setProvider(id);
                  setPayFromBalance(false);
                }}
                style={[
                  styles.rail,
                  !payFromBalance && provider === id && styles.railOn,
                ]}
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
            placeholder="Mon numéro"
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Pressable onPress={() => void saveContacts()}>
            <Text style={styles.link}>Enregistrer ce numéro</Text>
          </Pressable>
          {payoutTo === "other" ? (
            <TextInput
              value={otherPhone}
              onChangeText={setOtherPhone}
              placeholder="Numéro du transfert"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="phone-pad"
              style={styles.input}
            />
          ) : null}
          <Pressable
            style={[styles.withdraw, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => void withdraw()}
          >
            <Text style={styles.withdrawText}>
              {payoutTo === "other" ? "Transfert" : "Retirer le fond"}
            </Text>
            <Text style={styles.withdrawMeta}>
              {withdrawGross != null && withdrawGross > 0
                ? `${formatMoney(withdrawGross, displayCurrency)} via CinetPay`
                : "Indique la somme"}
            </Text>
          </Pressable>

          <Text style={styles.section}>Recharger</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => {
                setTopUpFor("me");
                setPayFromBalance(false);
                setRecipients([]);
              }}
              style={[styles.choice, topUpFor === "me" && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>Moi</Text>
            </Pressable>
            <Pressable
              onPress={() => setTopUpFor("someone")}
              style={[styles.choice, topUpFor === "someone" && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>Quelqu{"\u2019"}un</Text>
            </Pressable>
          </View>
          {topUpFor === "someone" ? (
            <>
              <TextInput
                value={recipientQuery}
                onChangeText={(value) => {
                  setRecipientQuery(value);
                  setPicked(null);
                  if (value.trim().length < 2) setRecipients([]);
                }}
                placeholder="Nom, boutique ou numéro"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
              />
              {picked ? (
                <Text style={styles.hint}>
                  Tu recharges {picked.shopName ? `${picked.shopName} · ` : ""}
                  {picked.name}
                </Text>
              ) : (
                recipients.map((person) => (
                  <Pressable
                    key={person.id}
                    onPress={() => setPicked(person)}
                    style={styles.recipient}
                  >
                    <Text style={styles.recipientName} numberOfLines={1}>
                      {person.shopName
                        ? `${person.shopName} · ${person.name}`
                        : person.name}
                    </Text>
                    <Text style={styles.hint}>{person.phoneMasked}</Text>
                  </Pressable>
                ))
              )}
              <Pressable
                onPress={() => setPayFromBalance(true)}
                style={[styles.rail, payFromBalance && styles.railOn]}
              >
                <Text
                  style={[styles.railText, payFromBalance && styles.railTextOn]}
                >
                  Solde ShipShop
                </Text>
              </Pressable>
              <Text style={styles.hint}>
                {payFromBalance
                  ? "ShipShop débite ton solde et crédite cette personne."
                  : "CinetPay débite ton numéro et crédite cette personne."}
              </Text>
            </>
          ) : null}
          <View style={styles.amountRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Somme"
              placeholderTextColor="rgba(255,255,255,0.35)"
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
              {busy
                ? "Envoi…"
                : topUpFor === "someone" && payFromBalance
                  ? "Envoyer le solde"
                  : "Payer avec CinetPay"}
            </Text>
          </Pressable>
          {pendingId ? (
            <Pressable onPress={() => void confirmDeposit(pendingId)}>
              <Text style={styles.link}>J’ai payé — vérifier</Text>
            </Pressable>
          ) : null}

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
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
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
  fieldLabel: { color: "#fff", fontWeight: "700", marginTop: 4 },
  withdraw: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawText: {
    color: "#04281c",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },
  withdrawMeta: {
    color: "#04281c",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
  },
  section: { color: "#fff", fontWeight: "800", marginTop: 6 },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
  },
  choiceOn: { backgroundColor: "#FF7A00" },
  choiceText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  recipient: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127,127,140,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recipientName: { color: "#fff", fontWeight: "700" },
  rail: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
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
