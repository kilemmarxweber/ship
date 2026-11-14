import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
    fetchRemoteCisConsent,
    getLocalCisConsent,
    setCisConsent,
    type LocalCisConsent,
} from "@/src/cis/consent";
import { CIS_POLICY_VERSION } from "@/src/cis/types";
import { useSession } from "@/src/session";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function CisConsentSettings() {
  const c = useColors();
  const token = useSession((state) => state.token);
  const [consent, setConsent] = useState<LocalCisConsent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConsent(getLocalCisConsent());
    if (!token) return;
    void fetchRemoteCisConsent().then(() => {
      setConsent(getLocalCisConsent());
    });
  }, [token]);

  async function choose(status: "accepted" | "refused" | "withdrawn") {
    if (!token) {
      showToast("Connectez-vous pour gérer le CIS", "error");
      return;
    }
    setBusy(true);
    try {
      const next = await setCisConsent(status, {
        eraseData: status !== "accepted",
      });
      setConsent({
        status: next.status,
        policyVersion: next.policyVersion,
        decidedAt: next.decidedAt,
      });
      showToast(
        status === "accepted"
          ? "Personnalisation CIS activée"
          : "Personnalisation CIS désactivée",
        "success",
      );
    } catch {
      showToast("Impossible d’enregistrer le consentement", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = consent?.status ?? null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: "rgba(127,127,140,0.22)" },
      ]}
    >
      <Text style={[styles.title, { color: c.text }]}>
        Personnalisation (CIS)
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        Autorise ShipShop à utiliser vos interactions dans l’app (vues, likes,
        panier, achats) pour améliorer Pour toi et la recherche. Aucune lecture
        SMS, WhatsApp ou apps tierces. Version {CIS_POLICY_VERSION}.
      </Text>
      <Text style={[styles.status, { color: c.text }]}>
        État :{" "}
        {status === "accepted"
          ? "accepté"
          : status === "refused"
            ? "refusé"
            : status === "withdrawn"
              ? "retiré"
              : "non décidé"}
      </Text>
      <View style={styles.row}>
        <Pressable
          disabled={busy}
          onPress={() => void choose("accepted")}
          style={[
            styles.btn,
            {
              backgroundColor:
                status === "accepted" ? c.emerald : "transparent",
              borderColor: "rgba(127,127,140,0.35)",
            },
          ]}
        >
          <Text
            style={{
              color: status === "accepted" ? "#fff" : c.text,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            Accepter
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => void choose("refused")}
          style={[styles.btn, { borderColor: "rgba(127,127,140,0.35)" }]}
        >
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>
            Refuser
          </Text>
        </Pressable>
        {status === "accepted" ? (
          <Pressable
            disabled={busy}
            onPress={() => void choose("withdrawn")}
            style={[styles.btn, { borderColor: "rgba(127,127,140,0.35)" }]}
          >
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>
              Retirer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18 },
  status: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
