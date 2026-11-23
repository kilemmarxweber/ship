import { IconBackButton } from "@/components/ui/IconBackButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

import { api } from "@/src/api";
import {
  DEFAULT_PUBLIC_FEES,
  netShipshopPct,
  type PublicFeeSettings,
} from "@/src/platform-fees";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

type FieldKey =
  | "depositFeePct"
  | "depositCinetPayPct"
  | "withdrawFeePct"
  | "withdrawCinetPayPct"
  | "transferExternalFeePct"
  | "transferExternalCinetPayPct"
  | "transferInternalFeePct"
  | "saleFeePctDefault"
  | "shippingFeePct";

const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  {
    key: "depositFeePct",
    label: "Versement — ShipShop %",
    hint: "Déduit du crédit (défaut 5)",
  },
  {
    key: "depositCinetPayPct",
    label: "Versement — CinetPay %",
    hint: "Coût provider (défaut 3)",
  },
  {
    key: "withdrawFeePct",
    label: "Retrait — ShipShop %",
    hint: "Déduit du brut (défaut 5)",
  },
  {
    key: "withdrawCinetPayPct",
    label: "Retrait — CinetPay %",
    hint: "Peut différer du versement",
  },
  {
    key: "transferExternalFeePct",
    label: "Transfert hors — ShipShop %",
    hint: "Via CinetPay / autre numéro",
  },
  {
    key: "transferExternalCinetPayPct",
    label: "Transfert hors — CinetPay %",
    hint: "Coût provider dédié",
  },
  {
    key: "transferInternalFeePct",
    label: "Transfert interne — ShipShop %",
    hint: "Solde → solde (défaut 0)",
  },
  {
    key: "saleFeePctDefault",
    label: "Achat — commission %",
    hint: "Base hors paliers volume",
  },
  {
    key: "shippingFeePct",
    label: "Livraison — ShipShop %",
    hint: "Reste = partenaire coursier",
  },
];

function pctToBps(pct: number) {
  return Math.round(pct * 100);
}

function parsePct(raw: string) {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(50, Math.max(0, n));
}

export function FeeSettingsScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<FieldKey, string>>({
    depositFeePct: "5",
    depositCinetPayPct: "3",
    withdrawFeePct: "5",
    withdrawCinetPayPct: "3",
    transferExternalFeePct: "5",
    transferExternalCinetPayPct: "3",
    transferInternalFeePct: "0",
    saleFeePctDefault: "5",
    shippingFeePct: "10",
  });

  const q = useQuery({
    queryKey: ["fee-settings", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ settings?: PublicFeeSettings }>("/api/admin/fee-settings"),
    retry: false,
  });

  useEffect(() => {
    const s = q.data?.settings ?? DEFAULT_PUBLIC_FEES;
    setDraft({
      depositFeePct: String(s.depositFeePct),
      depositCinetPayPct: String(s.depositCinetPayPct),
      withdrawFeePct: String(s.withdrawFeePct),
      withdrawCinetPayPct: String(s.withdrawCinetPayPct),
      transferExternalFeePct: String(s.transferExternalFeePct),
      transferExternalCinetPayPct: String(s.transferExternalCinetPayPct),
      transferInternalFeePct: String(s.transferInternalFeePct),
      saleFeePctDefault: String(s.saleFeePctDefault),
      shippingFeePct: String(s.shippingFeePct),
    });
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const field of FIELDS) {
        if (parsePct(draft[field.key]) == null) {
          throw new Error(`Valeur invalide: ${field.label}`);
        }
      }
      return api("/api/admin/fee-settings", {
        method: "PATCH",
        body: JSON.stringify({
          depositFeeBps: pctToBps(parsePct(draft.depositFeePct) ?? 5),
          depositCinetPayBps: pctToBps(parsePct(draft.depositCinetPayPct) ?? 3),
          withdrawFeeBps: pctToBps(parsePct(draft.withdrawFeePct) ?? 5),
          withdrawCinetPayBps: pctToBps(
            parsePct(draft.withdrawCinetPayPct) ?? 3,
          ),
          transferExternalFeeBps: pctToBps(
            parsePct(draft.transferExternalFeePct) ?? 5,
          ),
          transferExternalCinetPayBps: pctToBps(
            parsePct(draft.transferExternalCinetPayPct) ?? 3,
          ),
          transferInternalFeeBps: pctToBps(
            parsePct(draft.transferInternalFeePct) ?? 0,
          ),
          saleFeeBpsDefault: pctToBps(parsePct(draft.saleFeePctDefault) ?? 5),
          shippingFeeBps: pctToBps(parsePct(draft.shippingFeePct) ?? 10),
        }),
      });
    },
    onSuccess: async () => {
      showToast("Pourcentages enregistrés", "success");
      await queryClient.invalidateQueries({ queryKey: ["fee-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["platform-revenue"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "Enregistrement impossible",
        "error",
      );
    },
  });

  const depositNet = netShipshopPct(
    parsePct(draft.depositFeePct) ?? 0,
    parsePct(draft.depositCinetPayPct) ?? 0,
  );
  const withdrawNet = netShipshopPct(
    parsePct(draft.withdrawFeePct) ?? 0,
    parsePct(draft.withdrawCinetPayPct) ?? 0,
  );

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <IconBackButton color={c.text} />
      <Text style={[styles.title, { color: c.text }]}>Frais & pourcentages</Text>
      <Text style={[styles.lead, { color: c.textMuted }]}>
        Net ShipShop = max(0, % ShipShop − % CinetPay) sur les rails cash.
        Livraison : % ShipShop, reste au coursier.
      </Text>

      {!token ? (
        <Pressable
          style={[styles.primary, { backgroundColor: c.primary }]}
          onPress={openAuth}
        >
          <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
            Se connecter
          </Text>
        </Pressable>
      ) : q.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : q.isError ? (
        <Text style={{ color: c.textMuted, textAlign: "center", padding: 24 }}>
          Accès refusé ou API indisponible.
        </Text>
      ) : (
        <>
          <View
            style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
          >
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              Aperçu net · versement {depositNet.toFixed(2)} % · retrait{" "}
              {withdrawNet.toFixed(2)} %
            </Text>
          </View>

          {FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={[styles.label, { color: c.text }]}>{field.label}</Text>
              <Text style={[styles.hint, { color: c.textMuted }]}>
                {field.hint}
              </Text>
              <TextInput
                value={draft[field.key]}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, [field.key]: value }))
                }
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  {
                    color: c.text,
                    backgroundColor: c.card,
                    borderColor: HAIRLINE,
                  },
                ]}
              />
            </View>
          ))}

          <Pressable
            style={[
              styles.primary,
              { backgroundColor: c.primary, opacity: save.isPending ? 0.6 : 1 },
            ]}
            disabled={save.isPending}
            onPress={() => save.mutate()}
          >
            <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 24, fontWeight: "800" },
  lead: { fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12 },
  field: { gap: 4 },
  label: { fontWeight: "700", fontSize: 14 },
  hint: { fontSize: 11 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
