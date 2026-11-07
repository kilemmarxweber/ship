import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useState } from "react";
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

import { PagedMore } from "@/components/ui/PagedMore";
import { api, mediaUrl } from "@/src/api";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { usePaged } from "@/src/use-paged";
import { useColors } from "@/src/use-colors";

type Dossier = {
  id: string;
  status: string;
  sellerType: "INDIVIDUAL" | "BUSINESS" | null;
  legalName: string | null;
  phone: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    phone: string | null;
  };
};

export function SellerKycAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["kyc-admin", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ dossiers?: Dossier[] }>("/api/kyc/admin"),
    retry: false,
  });
  const dossiers = q.data?.dossiers ?? [];
  const paged = usePaged(dossiers, String(dossiers.length));
  const denied = q.isError;

  async function review(id: string, action: "APPROVE" | "REJECT") {
    const rejectReason = reasons[id]?.trim();
    if (action === "REJECT" && !rejectReason) {
      showToast("Indiquez un motif de refus", "error");
      return;
    }
    setBusyId(id);
    try {
      await api(`/api/kyc/admin/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          rejectReason: action === "REJECT" ? rejectReason : undefined,
        }),
      });
      showToast(
        action === "APPROVE" ? "Dossier approuvé" : "Dossier refusé",
        "success",
      );
      await queryClient.invalidateQueries({ queryKey: ["kyc-admin"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Action impossible",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

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
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Revue KYC vendeurs</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Dossiers soumis en attente d’approbation.
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
      ) : q.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : denied ? (
        <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 24 }}>
          Réservé à l’owner ou à un admin Chip Shop.
        </Text>
      ) : dossiers.length === 0 ? (
        <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 24 }}>
          Aucun dossier en attente
        </Text>
      ) : (
        <>
          {paged.visible.map((d) => {
            const selfie = mediaUrl(d.selfieUrl);
            const front = mediaUrl(d.idFrontUrl);
            return (
              <View
                key={d.id}
                style={[
                  styles.card,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  {d.legalName || d.user.name}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {d.user.email} · {d.phone || d.user.phone || "—"}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>
                  {d.sellerType ?? "—"} · {d.idNumber ?? "sans N°"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {selfie ? (
                    <Image source={{ uri: selfie }} style={styles.photo} contentFit="cover" />
                  ) : null}
                  {front ? (
                    <Image source={{ uri: front }} style={styles.photo} contentFit="cover" />
                  ) : null}
                </View>
                <TextInput
                  value={reasons[d.id] ?? ""}
                  onChangeText={(value) =>
                    setReasons((prev) => ({ ...prev, [d.id]: value }))
                  }
                  placeholder="Motif de refus (si refus)"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
                  ]}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    disabled={busyId === d.id}
                    onPress={() => void review(d.id, "APPROVE")}
                    style={[styles.btn, { backgroundColor: c.emerald, flex: 1 }]}
                  >
                    <Text style={{ color: "#04281c", fontWeight: "800" }}>
                      Approuver
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busyId === d.id}
                    onPress={() => void review(d.id, "REJECT")}
                    style={[styles.btn, { backgroundColor: "#FF453A", flex: 1 }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Refuser</Text>
                  </Pressable>
                </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
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
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  photo: { width: 72, height: 72, borderRadius: 12 },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  btn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
