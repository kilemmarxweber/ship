import { IconBackButton } from "@/components/ui/IconBackButton";
import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import {
    useEffect,
    useState,
    type ComponentProps,
    type ReactNode,
} from "react";
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

import { AppearanceSettings } from "@/components/profile/AppearanceSettings";
import { CisConsentSettings } from "@/components/profile/CisConsentSettings";
import { EventTicketSettings } from "@/components/profile/EventTicketSettings";
import { FlashPubSettings } from "@/components/profile/FlashPubSettings";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";
import { ShopHoursSettings } from "@/components/profile/ShopHoursSettings";
import { MediaStrip } from "@/components/publish/MediaStrip";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { badgeKey, badgeLabel, type GrowthBadge } from "@/src/growth";
import { useT, type MsgKey } from "@/src/i18n";
import { useMe } from "@/src/me";
import { usePrefs } from "@/src/prefs";
import { useRequireSession } from "@/src/require-session";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import {
    parseWalletCurrency,
    walletCents,
    type WalletBalances,
} from "@/src/wallet";

type SellerLink = {
  href: Href;
  label: string;
  hint?: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

function SellerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.sellerSection}>
      <Text style={[styles.sellerSectionTitle, { color: c.textMuted }]}>
        {title}
      </Text>
      <View style={styles.sellerSectionBody}>{children}</View>
    </View>
  );
}

type ProfileUser = {
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  locale?: string | null;
  theme?: string | null;
};

function isPhoneBackedEmail(email: string) {
  return /@phone\.shipshop$/i.test(email) || /@users\.phone$/i.test(email);
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const queryClient = useQueryClient();
  const { token, allowed } = useRequireSession();
  const openAuth = useSession((state) => state.openAuth);
  const logout = useSession((state) => state.logout);
  const applyRemote = usePrefs((state) => state.applyRemote);
  const me = useMe();
  const [mode, setMode] = useState<"buyer" | "seller">("buyer");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ user?: ProfileUser }>("/api/profile"),
  });
  const wallet = useQuery({
    queryKey: ["wallet", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ wallet?: WalletBalances; displayCurrency?: string }>("/api/wallet"),
  });
  const kyc = useQuery({
    queryKey: ["kyc", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        kyc?: { status?: string; rejectReason?: string | null } | null;
        isOwner?: boolean;
      }>("/api/kyc").catch(() => ({ kyc: null, isOwner: false })),
  });
  const growth = useQuery({
    queryKey: ["growth-me", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ badges?: GrowthBadge[] }>("/api/growth/me").catch(() => ({
        badges: [] as GrowthBadge[],
      })),
  });

  const user = profile.data?.user;
  const displayName = user?.name || "Utilisateur";
  const rawEmail = user?.email ?? "";
  const displayEmail = isPhoneBackedEmail(rawEmail) ? "" : rawEmail;
  const displayPhone = user?.phone ?? "";
  const displayImage = user?.image ?? null;
  const currency = parseWalletCurrency(
    wallet.data?.displayCurrency ?? wallet.data?.wallet?.currency,
  );
  const balance = walletCents(wallet.data?.wallet, currency);
  const kycStatus = kyc.data?.kyc?.status ?? "NONE";
  const isPro = kycStatus === "APPROVED";
  const isOwner = Boolean(kyc.data?.isOwner);
  const badges = Array.isArray(growth.data?.badges) ? growth.data.badges : [];
  const isSeller = (me.data?.shopIds.length ?? 0) > 0 || isPro || isOwner;

  useEffect(() => {
    if (!user) return;
    void applyRemote({ locale: user.locale, theme: user.theme });
  }, [applyRemote, user]);

  function startEdit() {
    setName(user?.name ?? "");
    setEmail(isPhoneBackedEmail(user?.email ?? "") ? "" : (user?.email ?? ""));
    setPhone(user?.phone ?? "");
    setAvatar(user?.image ? [user.image] : []);
    setEditing(true);
  }

  async function save() {
    if (name.trim().length < 2) {
      showToast("Nom trop court", "error");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ user?: ProfileUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
          phone: phone.trim() || null,
          ...(avatar[0] ? { image: avatar[0] } : {}),
        }),
      });
      if (!data.user) throw new Error("Échec enregistrement");
      await queryClient.invalidateQueries({
        queryKey: ["profile", token ?? "guest"],
      });
      setEditing(false);
      showToast("Profil mis à jour", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Échec enregistrement",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    setLogoutOpen(false);
    void logout().then(() => {
      safeBack();
    });
  }

  return (
    <>
      <ScrollView
        style={[styles.wrap, { backgroundColor: c.background }]}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <IconBackButton color={c.text} />
          {token ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Se déconnecter"
              hitSlop={8}
              style={[
                styles.logoutBtn,
                {
                  borderColor: `${c.primary}73`,
                  backgroundColor: `${c.primary}26`,
                },
              ]}
              onPress={() => setLogoutOpen(true)}
            >
              <Ionicons name="log-out-outline" size={20} color={c.primary} />
            </Pressable>
          ) : null}
        </View>

        {!allowed ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : profile.isLoading ? (
          <ActivityIndicator color={c.emerald} />
        ) : (
          <>
            <View style={styles.hero}>
              {displayImage ? (
                <Image
                  source={{ uri: mediaUrl(displayImage) ?? displayImage }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={["#FF7A00", "#7C5CFF"]}
                  style={styles.avatar}
                >
                  <Text style={styles.letter}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              <View style={styles.nameRow}>
                <Text style={[styles.title, { color: c.text }]}>
                  {displayName}
                </Text>
                {isPro ? (
                  <View style={styles.pro}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#04281c"
                    />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                ) : null}
                <Pressable onPress={startEdit} hitSlop={8}>
                  <Ionicons name="pencil" size={16} color={c.textMuted} />
                </Pressable>
              </View>
              {displayEmail ? (
                <Text style={[styles.lead, { color: c.textMuted }]}>
                  {displayEmail}
                </Text>
              ) : null}
              <Text style={[styles.lead, { color: c.textMuted }]}>
                {displayPhone || "Aucun téléphone"}
              </Text>
            </View>

            {editing ? (
              <View style={styles.edit}>
                <Text style={[styles.section, { color: c.text }]}>
                  Modifier le profil
                </Text>
                <MediaStrip
                  urls={avatar}
                  onChange={(next) => setAvatar(next.slice(0, 1))}
                  max={1}
                  kind="images"
                  variant="avatar"
                  busy={mediaBusy}
                  setBusy={setMediaBusy}
                />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nom"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.input}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="E-mail (optionnel)"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Téléphone"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <View style={styles.editRow}>
                  <Pressable
                    style={styles.ghost}
                    onPress={() => setEditing(false)}
                  >
                    <Text style={styles.ghostText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primary,
                      { flex: 1 },
                      saving && { opacity: 0.6 },
                    ]}
                    disabled={saving || mediaBusy}
                    onPress={() => void save()}
                  >
                    <Text style={styles.primaryText}>
                      {saving ? "…" : "Enregistrer"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => router.push("/wallet" as Href)}
              style={styles.wallet}
            >
              <View>
                <Text style={[styles.walletLabel, { color: c.textMuted }]}>
                  Portefeuille
                </Text>
                <Text style={[styles.walletValue, { color: c.emerald }]}>
                  {formatMoney(balance, currency)}
                </Text>
                <Text style={[styles.lead, { color: c.textMuted }]}>
                  Recharger ou retirer via CinetPay
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>

            {badges.length > 0 ? (
              <View style={styles.badgeRow}>
                {badges.slice(0, 6).map((badge, index) => (
                  <View
                    key={badgeKey(badge, index)}
                    style={[
                      styles.badge,
                      {
                        backgroundColor: badge?.active
                          ? badge.kind === "INFLUENCER"
                            ? "rgba(251,191,36,0.12)"
                            : "rgba(0,214,143,0.12)"
                          : "rgba(127,127,140,0.14)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={badge?.kind === "INFLUENCER" ? "star" : "flame"}
                      size={12}
                      color={
                        badge?.kind === "INFLUENCER" ? "#FBBF24" : c.emerald
                      }
                    />
                    <Text style={[styles.badgeText, { color: c.text }]}>
                      {badgeLabel(badge)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={[
                styles.modeSwitch,
                { backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            >
              {(["buyer", "seller"] as const).map((key) => {
                const on = mode === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setMode(key)}
                    style={[
                      styles.modeBtn,
                      on && { backgroundColor: c.buyStart },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        { color: on ? "#fff" : c.textMuted },
                      ]}
                    >
                      {key === "buyer" ? t("buyer") : t("seller")}
                      {"\u00A0"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.grid}>
              <Pressable
                style={[styles.tile, { backgroundColor: c.card }]}
                onPress={() => router.push("/tickets" as Href)}
              >
                <Ionicons name="qr-code-outline" size={20} color="#2DD4BF" />
                <Text style={[styles.tileTitle, { color: c.text }]}>
                  {t("myTickets")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tile, { backgroundColor: c.card }]}
                onPress={() => router.push("/orders")}
              >
                <Ionicons name="receipt-outline" size={20} color="#FF7A00" />
                <Text style={[styles.tileTitle, { color: c.text }]}>
                  {t("orders")}
                </Text>
                <Text style={[styles.tileMeta, { color: c.textMuted }]}>
                  Suivi, QR, livraison
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tile, { backgroundColor: c.card }]}
                onPress={() => router.push("/courier")}
              >
                <Ionicons name="bicycle-outline" size={20} color={c.emerald} />
                <Text style={[styles.tileTitle, { color: c.text }]}>
                  {t("courier")}
                </Text>
                <Text style={[styles.tileMeta, { color: c.textMuted }]}>
                  Courses et pot
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tile, { backgroundColor: c.card }]}
                onPress={() =>
                  token ? router.push("/kyc" as Href) : openAuth()
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={isPro ? "#3B82F6" : c.textMuted}
                />
                <Text style={[styles.tileTitle, { color: c.text }]}>
                  Vérification
                </Text>
                <Text style={[styles.tileMeta, { color: c.textMuted }]}>
                  {kycStatus === "APPROVED"
                    ? "Compte PRO"
                    : kycStatus === "PENDING"
                      ? "En revue"
                      : kycStatus === "REJECTED"
                        ? "Refusé"
                        : "KYC Business"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.missionCard, { backgroundColor: c.card }]}
              onPress={() => router.push("/community" as Href)}
            >
              <Ionicons name="trophy-outline" size={22} color="#FBBF24" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.tileTitle, { color: c.text }]}>
                  {t("missions")}
                </Text>
                <Text style={[styles.tileMeta, { color: c.textMuted }]}>
                  {t("missionsHint")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.primary} />
            </Pressable>

            {mode === "seller" ? (
              <View style={styles.sellerStack}>
                <SellerSection title={t("sellerHub")}>
                  {(
                    [
                      {
                        href: "/seller/products",
                        label: t("myProducts"),
                        hint: t("myProductsHint"),
                        icon: "pricetag-outline",
                      },
                      {
                        href: "/shops/orders",
                        label: t("shopOrders"),
                        hint: t("shopOrdersHint"),
                        icon: "receipt-outline",
                      },
                      {
                        href: "/shops/contacts",
                        label: t("contacts"),
                        hint: t("contactsHint"),
                        icon: "people-outline",
                      },
                      {
                        href: "/seller/reports",
                        label: t("reports"),
                        hint: t("reportsHint"),
                        icon: "bar-chart-outline",
                      },
                      {
                        href: "/shops",
                        label: isOwner ? t("shopsAll") : t("shops"),
                        hint: "Gérer boutiques et équipe",
                        icon: "storefront-outline",
                      },
                      {
                        href: "/publish?mode=sell",
                        label: t("publish"),
                        hint: "Ajouter un article en vente",
                        icon: "add-circle-outline",
                      },
                      {
                        href: "/publish?mode=onboard",
                        label: t("onboard"),
                        hint: "Ouvrir une nouvelle boutique",
                        icon: "business-outline",
                      },
                    ] as SellerLink[]
                  ).map((item) => (
                    <ProfileMenuRow
                      key={`${item.href}-${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      hint={item.hint}
                      onPress={() => router.push(item.href)}
                    />
                  ))}
                </SellerSection>

                <SellerSection title={t("sellerCreate")}>
                  {(
                    [
                      {
                        href: "/community",
                        label: t("community"),
                        hint: t("communityHint"),
                        icon: "trophy-outline",
                      },
                      {
                        href: "/creator",
                        label: t("creator"),
                        hint: t("creatorHint"),
                        icon: "color-wand-outline",
                      },
                      {
                        href: "/live",
                        label: t("lives"),
                        hint: t("livesHint"),
                        icon: "radio-outline",
                      },
                    ] as SellerLink[]
                  ).map((item) => (
                    <ProfileMenuRow
                      key={`${item.href}-${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      hint={item.hint}
                      onPress={() => router.push(item.href)}
                    />
                  ))}
                </SellerSection>

                {isOwner ? (
                  <SellerSection title={t("sellerAdmin")}>
                    {(
                      [
                        {
                          href: "/shops/messaging",
                          label: "Messagerie & SMS",
                          hint: "Klambo, Infobip, templates",
                          icon: "chatbubbles-outline",
                        },
                        {
                          href: "/shops/admin/products",
                          label: "Modération produits",
                          hint: "Revue de tout le catalogue",
                          icon: "shield-outline",
                        },
                        {
                          href: "/shops/admin/vendors",
                          label: "Vendeurs & clients",
                          hint: "Comptes et rôles",
                          icon: "people-circle-outline",
                        },
                        {
                          href: "/shops/admin/ledger",
                          label: "Paiements",
                          hint: "Ledger et mouvements",
                          icon: "cash-outline",
                        },
                        {
                          href: "/shops/admin/revenue",
                          label: "Bénéfices plateforme",
                          hint: "Jour, mois, année · entrées / sorties",
                          icon: "trending-up-outline",
                        },
                        {
                          href: "/shops/admin/fee-settings",
                          label: "Frais & pourcentages",
                          hint: "ShipShop, CinetPay, livraison",
                          icon: "options-outline",
                        },
                        {
                          href: "/shops/admin/attention",
                          label: "KPI attention",
                          hint: "Performance feed et pubs",
                          icon: "pulse-outline",
                        },
                        {
                          href: "/shops/admin/campaigns",
                          label: "Stories partenaires",
                          hint: "Campagnes et placements",
                          icon: "images-outline",
                        },
                        {
                          href: "/shops/admin/challenges",
                          label: "Challenges",
                          hint: "Défis et récompenses",
                          icon: "flag-outline",
                        },
                        {
                          href: "/shops/admin/expansion",
                          label: "Expansion",
                          hint: "Playbook territoires",
                          icon: "map-outline",
                        },
                        {
                          href: "/shops/admin/content",
                          label: "Contenu CMS",
                          hint: "Système et Sanity",
                          icon: "document-text-outline",
                        },
                        {
                          href: "/shops/kyc",
                          label: "Revue KYC",
                          hint: "Dossiers vendeurs",
                          icon: "shield-checkmark-outline",
                        },
                        {
                          href: "/shops/admin/moderation",
                          label: "Modération contenu",
                          hint: "Filtres NSFW et signalements",
                          icon: "eye-off-outline",
                        },
                      ] as SellerLink[]
                    ).map((item) => (
                      <ProfileMenuRow
                        key={`${item.href}-${item.label}`}
                        icon={item.icon}
                        label={item.label}
                        hint={item.hint}
                        onPress={() => router.push(item.href)}
                      />
                    ))}
                  </SellerSection>
                ) : null}

                {!isSeller ? (
                  <Text style={[styles.lead, { color: c.textMuted }]}>
                    {t("sellerEmpty")}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {mode === "seller" && isOwner ? <FlashPubSettings /> : null}
            {mode === "seller" && isOwner ? <EventTicketSettings /> : null}
            {mode === "seller" ? <ShopHoursSettings /> : null}
          </>
        )}

        <CisConsentSettings />
        <AppearanceSettings />

        <Text style={[styles.section, { color: c.text }]}>{t("settings")}</Text>
        {(
          [
            ["/legal/confidentialite", "privacy", "shield-outline"],
            ["/legal/cgu", "terms", "document-text-outline"],
            ["/legal/aide", "helpVendor", "help-circle-outline"],
            ["/legal/shiprewards", "shiprewards", "gift-outline"],
          ] as const satisfies readonly [
            string,
            MsgKey,
            ComponentProps<typeof Ionicons>["name"],
          ][]
        ).map(([href, key, icon]) => (
          <ProfileMenuRow
            key={href}
            icon={icon}
            label={t(key)}
            onPress={() => router.push(href as Href)}
          />
        ))}
      </ScrollView>
      <Modal
        visible={logoutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutOpen(false)}
      >
        <View style={styles.logoutOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLogoutOpen(false)}
            accessibilityLabel="Fermer"
          />
          <View
            style={[
              styles.logoutCard,
              { backgroundColor: c.sheet, borderColor: HAIRLINE },
            ]}
          >
            <View
              style={[
                styles.logoutIconWrap,
                { backgroundColor: `${c.primary}22` },
              ]}
            >
              <Ionicons name="log-out-outline" size={24} color={c.primary} />
            </View>
            <Text style={[styles.logoutTitle, { color: c.text }]}>
              Se déconnecter ?
            </Text>
            <Text style={[styles.logoutBody, { color: c.textMuted }]}>
              Tu quittes ton compte sur cet appareil. Tes achats et ton
              portefeuille restent liés à ce compte.
            </Text>
            <View style={styles.logoutActions}>
              <Pressable
                onPress={() => setLogoutOpen(false)}
                style={[
                  styles.logoutCancel,
                  { borderColor: HAIRLINE, backgroundColor: c.card },
                ]}
              >
                <Text style={[styles.logoutCancelText, { color: c.text }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmLogout}
                style={[styles.logoutConfirm, { backgroundColor: c.primary }]}
              >
                <Text
                  style={[
                    styles.logoutConfirmText,
                    { color: c.primaryForeground },
                  ]}
                >
                  Se déconnecter
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  logoutBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(10,10,15,0.55)",
  },
  logoutCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  logoutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutTitle: { fontSize: 20, fontWeight: "800" },
  logoutBody: { fontSize: 14, lineHeight: 20 },
  logoutActions: { gap: 8, marginTop: 4 },
  logoutCancel: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCancelText: { fontWeight: "700", fontSize: 16 },
  logoutConfirm: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  logoutConfirmText: { fontWeight: "800", fontSize: 16 },
  center: { gap: 10, paddingTop: 24 },
  hero: { alignItems: "center", gap: 6, paddingTop: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  letter: { color: "#fff", fontSize: 32, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  lead: { textAlign: "center", lineHeight: 18 },
  pro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00D68F",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proText: { color: "#04281c", fontWeight: "800", fontSize: 10 },
  edit: {
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 14,
  },
  section: { color: "#fff", fontWeight: "800" },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ghost: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostText: { color: "#fff", fontWeight: "800" },
  primary: {
    backgroundColor: "#FF7A00",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,214,143,0.1)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.25)",
  },
  walletLabel: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    fontSize: 12,
  },
  walletValue: { color: "#00D68F", fontSize: 26, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  tileTitle: { color: "#fff", fontWeight: "800" },
  tileMeta: { fontSize: 12 },
  missionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    minHeight: 64,
  },
  sellerStack: { gap: 16 },
  sellerSection: { gap: 8 },
  sellerSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  sellerSectionBody: { gap: 8 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    includeFontPadding: false,
    paddingRight: 8,
    flexShrink: 0,
  },
  modeSwitch: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeText: {
    fontWeight: "800",
    fontSize: 13,
    includeFontPadding: false,
    paddingHorizontal: 4,
    paddingRight: 8,
    flexShrink: 0,
  },
});
