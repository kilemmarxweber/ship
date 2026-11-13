import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { PagedMore } from "@/components/ui/PagedMore";
import { api, mediaUrl } from "@/src/api";
import { useT } from "@/src/i18n";
import { DEFAULT_FX_CDF } from "@/src/product-options";
import { useSession } from "@/src/session";
import { shopSocialPayload } from "@/src/shop-social";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type ShopSocialDraft = {
  tiktok: string;
  facebook: string;
  instagram: string;
  x: string;
};

type Shop = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  currency?: string;
  fxCdfPerUsd?: number;
  isActive?: boolean;
  owner?: { id: string; name: string; email: string } | null;
  _count?: { products: number };
  proUntil?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

function socialDraftFromShop(shop: Shop): ShopSocialDraft {
  return {
    tiktok: shop.tiktokUrl?.trim() ?? "",
    facebook: shop.facebookUrl?.trim() ?? "",
    instagram: shop.instagramUrl?.trim() ?? "",
    x: shop.xUrl?.trim() ?? "",
  };
}

type OrgMember = {
  id: string;
  role: string;
  userId: string;
  shopCount: number;
  kind: "vendor" | "buyer";
  isMe?: boolean;
  user: { id: string; name: string; email: string; phone?: string | null };
};

const EMPTY_SHOPS: Shop[] = [];
const EMPTY_MEMBERS: OrgMember[] = [];

export function SellerShopsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [fxDrafts, setFxDrafts] = useState<Record<string, string>>({});
  const [fxSavingId, setFxSavingId] = useState<string | null>(null);
  const [socialDrafts, setSocialDrafts] = useState<
    Record<string, ShopSocialDraft>
  >({});
  const [socialSavingId, setSocialSavingId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<"all" | "vendor" | "buyer">(
    "all",
  );
  const [roleBusy, setRoleBusy] = useState<string | null>(null);

  const shopsQ = useQuery({
    queryKey: ["seller-shops-page", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: async () => {
      const mine = await api<{
        shops?: Shop[];
        isPlatformOwner?: boolean;
      }>("/api/shops?mine=1");
      let members: OrgMember[] = [];
      let isOrgOwner = false;
      try {
        const org = await api<{
          members?: OrgMember[];
          isOwner?: boolean;
        }>("/api/org/members");
        members = org.members ?? [];
        isOrgOwner = Boolean(org.isOwner);
      } catch {
        members = [];
      }
      return {
        shops: mine.shops ?? [],
        isOwner: Boolean(mine.isPlatformOwner || isOrgOwner),
        isOrgOwner,
        members,
      };
    },
  });

  const shops = shopsQ.data?.shops ?? EMPTY_SHOPS;
  const isOwner = Boolean(shopsQ.data?.isOwner);
  const isOrgOwner = Boolean(shopsQ.data?.isOrgOwner);
  const members = shopsQ.data?.members ?? EMPTY_MEMBERS;

  useEffect(() => {
    setSocialDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const shop of shops) {
        if (next[shop.id]) continue;
        next[shop.id] = socialDraftFromShop(shop);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [shops]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter((shop) =>
      `${shop.name} ${shop.slug} ${shop.owner?.name ?? ""} ${shop.owner?.email ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [shops, query]);

  const pagedShops = usePaged(visible, `${query}-${visible.length}`);
  const filteredMembers = useMemo(
    () =>
      members.filter((m) =>
        memberFilter === "all" ? true : m.kind === memberFilter,
      ),
    [members, memberFilter],
  );
  const pagedMembers = usePaged(
    filteredMembers,
    `${memberFilter}-${filteredMembers.length}`,
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["seller-shops-page"] });
  }

  async function saveFx(shop: Shop) {
    const raw = fxDrafts[shop.id];
    const next =
      Number.parseInt(raw ?? String(shop.fxCdfPerUsd ?? DEFAULT_FX_CDF), 10) ||
      DEFAULT_FX_CDF;
    setFxSavingId(shop.id);
    try {
      await api(`/api/shops/${shop.slug}`, {
        method: "PATCH",
        body: JSON.stringify({ fxCdfPerUsd: next }),
      });
      showToast("Taux du jour enregistré", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Taux non enregistré",
        "error",
      );
    } finally {
      setFxSavingId(null);
    }
  }

  function patchSocial(
    shopId: string,
    key: keyof ShopSocialDraft,
    value: string,
  ) {
    setSocialDrafts((prev) => ({
      ...prev,
      [shopId]: {
        ...(prev[shopId] ??
          socialDraftFromShop(
            shops.find((s) => s.id === shopId) ?? {
              id: shopId,
              name: "",
              slug: "",
            },
          )),
        [key]: value,
      },
    }));
  }

  async function saveSocials(shop: Shop) {
    const draft = socialDrafts[shop.id] ?? socialDraftFromShop(shop);
    setSocialSavingId(shop.id);
    try {
      const payload = shopSocialPayload(draft);
      await api(`/api/shops/${shop.slug}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSocialDrafts((prev) => {
        const next = { ...prev };
        delete next[shop.id];
        return next;
      });
      showToast("Réseaux sociaux enregistrés", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Réseaux non enregistrés",
        "error",
      );
    } finally {
      setSocialSavingId(null);
    }
  }

  async function activatePro(shop: Shop) {
    try {
      await api(`/api/shops/${shop.slug}/pro`, { method: "POST" });
      showToast("ShipPro activé 30 jours (10 $US) — optionnel", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "ShipPro impossible",
        "error",
      );
    }
  }

  async function changeRole(memberId: string, role: string) {
    setRoleBusy(memberId);
    try {
      await api("/api/org/members", {
        method: "PATCH",
        body: JSON.stringify({ memberId, role }),
      });
      showToast("Rôle mis à jour", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Rôle non modifié",
        "error",
      );
    } finally {
      setRoleBusy(null);
    }
  }

  function resetPassword(user: { id: string; name: string; email: string }) {
    Alert.alert(
      "Réinitialiser le mot de passe ?",
      `Réinitialiser le mot de passe de ${user.name} (${user.email}) et l'envoyer par e-mail + WhatsApp ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                const data = await api<{ temporaryPassword?: string }>(
                  `/api/admin/users/${user.id}/reset-password`,
                  { method: "POST" },
                );
                showToast("Mot de passe réinitialisé et envoyé", "success");
                if (data.temporaryPassword) {
                  showToast(
                    `MDP temporaire : ${data.temporaryPassword}`,
                    "info",
                  );
                }
              } catch (cause) {
                showToast(
                  cause instanceof Error ? cause.message : "Reset impossible",
                  "error",
                );
              }
            })();
          },
        },
      ],
    );
  }

  const shortcuts = [
    { href: "/seller/products", label: "Produits" },
    { href: "/shops/orders", label: "Commandes" },
    { href: "/seller/reports", label: "Rapports" },
    { href: "/shops/contacts", label: "Contacts" },
    { href: "/shops/delivery", label: "Livraison" },
    ...(isOwner
      ? [
          { href: "/shops/messaging", label: "Messages" },
          { href: "/shops/admin/products", label: "Modération" },
          { href: "/shops/admin/vendors", label: "Vendeurs" },
          { href: "/shops/admin/ledger", label: "Ledger" },
          { href: "/shops/kyc", label: "KYC" },
          { href: "/shops/admin/attention", label: "KPI" },
        ]
      : []),
    { href: "/publish?mode=onboard", label: "+ Boutique" },
  ] as const;

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
          {isOwner ? "Toutes les boutiques" : "Mes boutiques"}
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          1 organisation → plusieurs shops
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
      ) : shopsQ.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {shortcuts.map((item) => (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as Href)}
                style={[
                  styles.shortcut,
                  item.label === "Produits"
                    ? { backgroundColor: c.primary }
                    : {
                        backgroundColor: c.card,
                        borderColor: HAIRLINE,
                        borderWidth: 1,
                      },
                ]}
              >
                <Text
                  style={{
                    color:
                      item.label === "Produits" ? c.primaryForeground : c.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.headRow}>
            <Text style={[styles.section, { color: c.text }]}>Boutiques</Text>
            <Pressable
              onPress={() => router.push("/publish?mode=onboard" as Href)}
              style={[styles.addBtn, { backgroundColor: c.primary }]}
            >
              <Ionicons name="add" size={14} color={c.primaryForeground} />
              <Text
                style={{
                  color: c.primaryForeground,
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                Shop
              </Text>
            </Pressable>
          </View>

          {shops.length > 1 ? (
            <View
              style={[
                styles.search,
                { backgroundColor: c.card, borderColor: HAIRLINE },
              ]}
            >
              <Ionicons name="search" size={16} color={c.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher une boutique"
                placeholderTextColor={c.textMuted}
                style={{ flex: 1, color: c.text, paddingVertical: 0 }}
              />
            </View>
          ) : null}

          {pagedShops.visible.map((shop) => {
            const fx =
              fxDrafts[shop.id] ?? String(shop.fxCdfPerUsd ?? DEFAULT_FX_CDF);
            const logo = mediaUrl(shop.logoUrl);
            const proActive =
              shop.proUntil != null && new Date(shop.proUntil) > new Date();
            return (
              <View
                key={shop.id}
                style={[
                  styles.card,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {logo ? (
                    <Image
                      source={{ uri: logo }}
                      style={styles.logo}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.logo,
                        {
                          backgroundColor: c.primary,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800" }}>
                        {shop.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: "800" }}>
                      {shop.name}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11 }}>
                      /{shop.slug} · {shop.currency ?? "USD"} ·{" "}
                      {shop._count?.products ?? 0} produits
                      {shop.owner?.name ? ` · ${shop.owner.name}` : ""}
                      {shop.isActive === false ? " · off" : ""}
                    </Text>
                    <Text
                      style={{ color: c.emerald, fontSize: 11, marginTop: 2 }}
                    >
                      1 $US = {Number(fx).toLocaleString("fr-CD")} CDF
                    </Text>
                  </View>
                </View>

                <Text style={[styles.label, { color: c.textMuted }]}>
                  Taux du jour (config vendeur)
                </Text>
                <View style={styles.fxRow}>
                  <TextInput
                    keyboardType="number-pad"
                    value={fx}
                    onChangeText={(value) =>
                      setFxDrafts((prev) => ({ ...prev, [shop.id]: value }))
                    }
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        backgroundColor: "rgba(127,127,140,0.12)",
                      },
                    ]}
                  />
                  <Pressable
                    disabled={fxSavingId === shop.id}
                    onPress={() => void saveFx(shop)}
                    style={[styles.saveBtn, { backgroundColor: c.primary }]}
                  >
                    <Text
                      style={{
                        color: c.primaryForeground,
                        fontWeight: "800",
                        fontSize: 13,
                      }}
                    >
                      {fxSavingId === shop.id ? "…" : "Sauver"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.label, { color: c.textMuted }]}>
                  Réseaux sociaux (contact boutique)
                </Text>
                {(
                  [
                    ["tiktok", "TikTok — @compte ou lien"],
                    ["instagram", "Instagram — @compte ou lien"],
                    ["facebook", "Facebook — page ou lien"],
                    ["x", "X — @compte ou lien"],
                  ] as const
                ).map(([key, placeholder]) => (
                  <TextInput
                    key={key}
                    value={
                      (socialDrafts[shop.id] ?? socialDraftFromShop(shop))[key]
                    }
                    onChangeText={(value) => patchSocial(shop.id, key, value)}
                    placeholder={placeholder}
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.socialInput,
                      {
                        color: c.text,
                        backgroundColor: "rgba(127,127,140,0.12)",
                      },
                    ]}
                  />
                ))}
                <Pressable
                  disabled={socialSavingId === shop.id}
                  onPress={() => void saveSocials(shop)}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: c.primary,
                      alignSelf: "stretch",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: c.primaryForeground,
                      fontWeight: "800",
                      fontSize: 13,
                    }}
                  >
                    {socialSavingId === shop.id
                      ? "…"
                      : "Enregistrer les réseaux"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void activatePro(shop)}
                  style={[styles.proBtn, { borderColor: HAIRLINE }]}
                >
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 12 }}
                  >
                    {proActive ? "ShipPro actif" : "ShipPro 10 $/mois"}
                  </Text>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push(`/boutique?shop=${shop.slug}` as Href)
                    }
                    style={[styles.action, { borderColor: HAIRLINE }]}
                  >
                    <Text
                      style={{ color: c.text, fontWeight: "700", fontSize: 12 }}
                    >
                      Entrer
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(`/seller/products?shopId=${shop.id}` as Href)
                    }
                    style={[styles.action, { borderColor: HAIRLINE }]}
                  >
                    <Text
                      style={{ color: c.text, fontWeight: "700", fontSize: 12 }}
                    >
                      Produits
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/publish?mode=sell&shopId=${shop.id}` as Href,
                      )
                    }
                    style={[
                      styles.action,
                      { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Text
                      style={{ color: c.text, fontWeight: "700", fontSize: 12 }}
                    >
                      Publier
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <PagedMore
            hasMore={pagedShops.hasMore}
            remaining={pagedShops.remaining}
            onMore={pagedShops.more}
          />
          {visible.length === 0 ? (
            <Text
              style={{
                color: c.textMuted,
                textAlign: "center",
                paddingVertical: 24,
              }}
            >
              {shops.length === 0
                ? "Aucune boutique — créez-en une pour publier."
                : "Aucune boutique ne correspond."}
            </Text>
          ) : null}

          <View style={{ marginTop: 8, gap: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="people-outline" size={16} color={c.primary} />
              <Text style={[styles.section, { color: c.text }]}>
                Utilisateurs
              </Text>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16 }}>
              {isOwner
                ? "Owner : tous les membres. Vendeurs = ont une boutique · acheteurs = sans boutique."
                : "Vous voyez uniquement votre compte et les personnes que vous avez invitées. Acheteurs / abonnés → Contacts."}
            </Text>
            <View style={styles.tabs}>
              {(
                [
                  ["all", "Tous", members.length],
                  [
                    "vendor",
                    "Vendeurs",
                    members.filter((m) => m.kind === "vendor").length,
                  ],
                  [
                    "buyer",
                    "Acheteurs",
                    members.filter((m) => m.kind === "buyer").length,
                  ],
                ] as const
              ).map(([key, label, count]) => {
                const on = memberFilter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMemberFilter(key)}
                    style={[
                      styles.chip,
                      on
                        ? { backgroundColor: c.primary }
                        : { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? c.primaryForeground : c.textMuted,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {pagedMembers.visible.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.member,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.text, fontWeight: "700" }}>
                    {m.user.name}
                    {m.isMe ? (
                      <Text style={{ color: c.primary }}> (vous)</Text>
                    ) : null}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    {m.user.email}
                  </Text>
                  <Text
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 4,
                      color: m.kind === "vendor" ? c.primary : c.textMuted,
                      backgroundColor:
                        m.kind === "vendor"
                          ? `${c.primary}22`
                          : "rgba(127,127,140,0.14)",
                      overflow: "hidden",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {m.kind === "vendor"
                      ? `Vendeur · ${m.shopCount} boutique${m.shopCount > 1 ? "s" : ""}`
                      : "Acheteur"}
                  </Text>
                </View>
                <View style={{ gap: 6, alignItems: "flex-end" }}>
                  {isOwner ? (
                    <Pressable
                      onPress={() => resetPassword(m.user)}
                      style={[styles.miniBtn, { borderColor: HAIRLINE }]}
                    >
                      <Text
                        style={{
                          color: c.text,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        Reset MDP
                      </Text>
                    </Pressable>
                  ) : null}
                  {isOrgOwner && m.role !== "owner" ? (
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {(["member", "admin"] as const).map((role) => {
                        const on = m.role === role;
                        return (
                          <Pressable
                            key={role}
                            disabled={roleBusy === m.id}
                            onPress={() => void changeRole(m.id, role)}
                            style={[
                              styles.miniBtn,
                              on
                                ? { backgroundColor: c.primary }
                                : { borderColor: HAIRLINE, borderWidth: 1 },
                            ]}
                          >
                            <Text
                              style={{
                                color: on ? c.primaryForeground : c.text,
                                fontSize: 11,
                                fontWeight: "700",
                                textTransform: "capitalize",
                              }}
                            >
                              {role}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: c.textMuted,
                        fontSize: 11,
                        textTransform: "capitalize",
                      }}
                    >
                      {m.role}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            <PagedMore
              hasMore={pagedMembers.hasMore}
              remaining={pagedMembers.remaining}
              onMore={pagedMembers.more}
            />
          </View>
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
  lead: { fontSize: 13, marginTop: 4 },
  shortcut: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { fontSize: 14, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  label: { fontSize: 11, fontWeight: "700" },
  fxRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  socialInput: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    minWidth: 80,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  proBtn: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: 6 },
  action: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 34,
    justifyContent: "center",
  },
  member: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  miniBtn: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
