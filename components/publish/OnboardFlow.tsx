import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { MediaStrip } from "@/components/publish/MediaStrip";
import { api } from "@/src/api";
import { getDeviceCoords } from "@/src/geo";
import {
    APP_CURRENCIES,
    DEFAULT_FX_CDF,
    type AppCurrency,
} from "@/src/product-options";
import { useSession } from "@/src/session";
import { shopSocialPayload } from "@/src/shop-social";
import { colors, HAIRLINE, type ThemeColors } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function OnboardFlow({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeOnboardStyles(c), [c]);
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string[]>([]);
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [fx, setFx] = useState(String(DEFAULT_FX_CDF));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [x, setX] = useState("");

  useEffect(() => {
    void getDeviceCoords()
      .then((coords) => {
        setLat(coords.latitude);
        setLng(coords.longitude);
      })
      .catch(() => {});
  }, []);

  async function locate() {
    try {
      const coords = await getDeviceCoords();
      setLat(coords.latitude);
      setLng(coords.longitude);
      showToast("Position boutique enregistrée", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "GPS indisponible",
        "error",
      );
    }
  }

  async function submit() {
    if (name.trim().length < 2) {
      showToast("Nom de boutique trop court", "error");
      return;
    }
    if (!confirmed) {
      showToast("Valide le taux de change du jour", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/seller/onboard", {
        method: "POST",
        body: JSON.stringify({
          shopName: name.trim(),
          description: description.trim() || undefined,
          logoUrl: logo[0] || undefined,
          currency,
          fxCdfPerUsd: Number.parseInt(fx, 10) || DEFAULT_FX_CDF,
          fxConfirmed: true,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
          ...shopSocialPayload({ tiktok, facebook, instagram, x }),
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["my-shops", token ?? "guest"],
      });
      await queryClient.refetchQueries({
        queryKey: ["my-shops", token ?? "guest"],
      });
      showToast("Boutique créée", "success");
      onCreated();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Boutique impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityLabel="Retour" onPress={onBack} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        
      </Pressable>
      <Text style={styles.title}>Devenir Business</Text>
      <Text style={styles.lead}>
        Crée ta boutique Business — ensuite tu publies en 3 gestes : vidéo,
        prix, poster. Mode, Aliment, Coiffure, Tech… tout s’y vend.
      </Text>

      <Text style={styles.label}>Logo (optionnel)</Text>
      <MediaStrip
        urls={logo}
        onChange={(next) => setLogo(next.slice(0, 1))}
        max={1}
        kind="images"
        variant="avatar"
        busy={mediaBusy}
        setBusy={setMediaBusy}
      />

      <Text style={styles.label}>Nom de la boutique</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="IShop Officiel"
        placeholderTextColor={c.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>Monnaie</Text>
      <View style={styles.row}>
        {APP_CURRENCIES.map((item) => (
          <Pressable
            key={item}
            onPress={() => setCurrency(item)}
            style={[styles.chip, currency === item && styles.chipOn]}
          >
            <Text
              style={[styles.chipText, currency === item && styles.chipTextOn]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Taux CDF / USD</Text>
      <TextInput
        value={fx}
        onChangeText={setFx}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Pressable
        onPress={() => setConfirmed((value) => !value)}
        style={styles.check}
      >
        <Ionicons
          name={confirmed ? "checkbox" : "square-outline"}
          size={20}
          color={confirmed ? c.primary : c.textMuted}
        />
        <Text style={styles.checkText}>Je valide le taux du jour</Text>
      </Pressable>

      <Pressable style={styles.ghost} onPress={() => void locate()}>
        <Ionicons name="locate" size={16} color={c.primary} />
        <Text style={styles.ghostText}>
          {lat != null ? "Position enregistrée" : "Ma position boutique"}
        </Text>
      </Pressable>

      <Text style={styles.label}>Description (optionnel)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Ce que tu publies (ex : Mode, Aliment, Coiffure)"
        placeholderTextColor={c.textMuted}
        style={[styles.input, styles.area]}
        multiline
      />

      <Text style={styles.label}>Réseaux sociaux (optionnel)</Text>
      <Text style={styles.socialHint}>
        Comme WhatsApp (téléphone du compte) : ces liens s’affichent sur ta
        fiche et ouvrent directement ton profil.
      </Text>
      <TextInput
        value={tiktok}
        onChangeText={setTiktok}
        placeholder="TikTok — @compte ou lien"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={instagram}
        onChangeText={setInstagram}
        placeholder="Instagram — @compte ou lien"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={facebook}
        onChangeText={setFacebook}
        placeholder="Facebook — page ou lien"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={x}
        onChangeText={setX}
        placeholder="X — @compte ou lien"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      <Pressable
        style={[styles.ctaPress, busy && { opacity: 0.7 }]}
        disabled={busy}
        onPress={() => void submit()}
      >
        <View style={[styles.cta, { backgroundColor: c.primary }]}>
          <Text style={styles.ctaText}>
            {busy ? "Création…" : "Lancer mon Business"}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

function makeOnboardStyles(c: ThemeColors = colors) {
  return StyleSheet.create({
    wrap: { gap: 10, paddingBottom: 24 },
    back: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingRight: 16,
      overflow: "visible",
      minWidth: 44,
      minHeight: 44,

    },
    title: { color: c.text, fontSize: 26, fontWeight: "800" },
    lead: { color: c.textMuted, lineHeight: 20, marginBottom: 6 },
    label: { color: c.textMuted, fontWeight: "700", fontSize: 12 },
    socialHint: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -4,
    },
    input: {
      backgroundColor: c.card,
      borderRadius: 14,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    area: { minHeight: 88, textAlignVertical: "top" },
    row: { flexDirection: "row", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.text, fontWeight: "800" },
    chipTextOn: { color: c.primaryForeground },
    check: { flexDirection: "row", alignItems: "center", gap: 8 },
    checkText: { color: c.text, fontWeight: "600" },
    ghost: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
    },
    ghostText: { color: c.primary, fontWeight: "700" },
    ctaPress: { width: "100%", marginTop: 8 },
    cta: {
      width: "100%",
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    ctaText: { color: c.primaryForeground, fontWeight: "800" },
  });
}
