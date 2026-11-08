import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeBack } from "@/src/nav";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

type ConfigForm = {
  whatsappProvider: string;
  klamboBaseUrl: string;
  klamboDefaultCountry: string;
  klamboConfigured: boolean;
  smsBaseUrl: string;
  smsSender: string;
  smsConfigured: boolean;
  waBaseUrl: string;
  waFromNumber: string;
  waConfigured: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
  brandPrefix: string;
};

export function SellerMessagingScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [formEdit, setFormEdit] = useState<{
    token: string;
    value: ConfigForm;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["messaging-config", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ config?: ConfigForm; smtpConfigured?: boolean }>(
        "/api/messaging/config",
      ),
    retry: false,
  });

  const form =
    formEdit?.token === token ? formEdit.value : (q.data?.config ?? null);

  function updateForm<K extends keyof ConfigForm>(
    key: K,
    value: ConfigForm[K],
  ) {
    if (!token || !form) return;
    setFormEdit({ token, value: { ...form, [key]: value } });
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await api("/api/messaging/config", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      showToast("Config messaging enregistrée", "success");
      await queryClient.invalidateQueries({ queryKey: ["messaging-config"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
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
        <Text style={[styles.title, { color: c.text }]}>
          Messages / Klambo / SMS
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Config Infobip / WhatsApp / e-mail (owner)
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
      ) : q.isError || !form ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Réservé à l’owner plateforme.
        </Text>
      ) : (
        <>
          {(
            [
              ["brandPrefix", "Préfixe marque"],
              ["klamboBaseUrl", "Klambo base URL"],
              ["klamboDefaultCountry", "Pays Klambo"],
              ["smsBaseUrl", "SMS base URL"],
              ["smsSender", "Expéditeur SMS"],
              ["waBaseUrl", "WhatsApp base URL"],
              ["waFromNumber", "N° WhatsApp"],
              ["whatsappProvider", "Provider WhatsApp"],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={{ gap: 6 }}>
              <Text
                style={{ color: c.textMuted, fontSize: 12, fontWeight: "700" }}
              >
                {label}
              </Text>
              <TextInput
                value={String(form[key] ?? "")}
                onChangeText={(value) =>
                  updateForm(key, value)
                }
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
          {(
            [
              ["notifySms", "Notifier SMS"],
              ["notifyWhatsapp", "Notifier WhatsApp"],
              ["notifyEmail", "Notifier e-mail"],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={styles.switchRow}>
              <Text style={{ color: c.text, fontWeight: "700", flex: 1 }}>
                {label}
              </Text>
              <Switch
                value={Boolean(form[key])}
                onValueChange={(value) =>
                  updateForm(key, value)
                }
                trackColor={{ true: c.primary, false: "rgba(127,127,140,0.3)" }}
              />
            </View>
          ))}
          <Text style={{ color: c.textMuted, fontSize: 11 }}>
            Klambo {form.klamboConfigured ? "OK" : "à configurer"} · SMS{" "}
            {form.smsConfigured ? "OK" : "à configurer"} · WA{" "}
            {form.waConfigured ? "OK" : "à configurer"}
            {q.data?.smtpConfigured ? " · SMTP OK" : ""}
          </Text>
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[styles.primary, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
              {busy ? "…" : "Enregistrer"}
            </Text>
          </Pressable>
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
  title: { fontSize: 24, fontWeight: "800" },
  lead: { fontSize: 12, marginTop: 4 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
