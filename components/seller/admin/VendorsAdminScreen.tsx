import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { safeBack } from "@/src/nav";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type ShopProduct = {
  id: string;
  title: string;
  status: string;
  priceCents: number;
  quantity: number;
};

type Vendor = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productsCount: number;
  ordersCount: number;
  productsByStatus: Record<string, number>;
  products: ShopProduct[];
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    walletBalanceCents: number;
    liveAccessGranted?: boolean;
    memberId?: string | null;
    role?: string;
    kyc: { id: string; status: string; rejectReason: string | null } | null;
  } | null;
};

type Client = {
  id: string;
  memberId: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  ordersCount: number;
  walletBalanceCents: number;
  disabledAt: string | null;
  disabledReason: string | null;
  canDelete?: boolean;
  liveAccessGranted?: boolean;
};

type Tab = "vendors" | "clients";

type EditUser = {
  id: string;
  memberId: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  liveAccessGranted: boolean;
  kind: "client" | "vendor-owner";
};

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MiniBtn({
  label,
  onPress,
  disabled,
  danger,
  filled,
  c,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  filled?: boolean;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.miniBtn,
        filled
          ? { backgroundColor: c.primary, borderColor: c.primary }
          : {
              borderColor: danger ? "#E5484D" : HAIRLINE,
              backgroundColor: "transparent",
            },
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <Text
        style={{
          color: filled ? c.primaryForeground : danger ? "#E5484D" : c.text,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function VendorsAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((s) => s.token);
  const openAuth = useSession((s) => s.openAuth);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("vendors");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditUser | null>(null);
  const [saving, setSaving] = useState(false);

  const vendorsQ = useQuery({
    queryKey: ["admin-vendors", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ vendors?: Vendor[]; clients?: Client[] }>("/api/admin/vendors"),
    retry: false,
  });

  const orgQ = useQuery({
    queryKey: ["org-members-role", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        isOwner?: boolean;
        myRole?: string;
        isPlatformOwner?: boolean;
      }>("/api/org/members"),
    retry: false,
  });

  const isOrgOwner = Boolean(
    orgQ.data?.myRole === "owner" || orgQ.data?.isOwner,
  );

  const vendors = useMemo(
    () => vendorsQ.data?.vendors ?? [],
    [vendorsQ.data?.vendors],
  );
  const clients = useMemo(
    () => vendorsQ.data?.clients ?? [],
    [vendorsQ.data?.clients],
  );

  const filteredVendors = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.slug.toLowerCase().includes(s) ||
        (v.owner?.name ?? "").toLowerCase().includes(s) ||
        (v.owner?.email ?? "").toLowerCase().includes(s),
    );
  }, [vendors, q]);

  const filteredClients = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(
      (row) =>
        row.name.toLowerCase().includes(s) ||
        row.email.toLowerCase().includes(s) ||
        (row.phone ?? "").toLowerCase().includes(s),
    );
  }, [clients, q]);

  const pagedVendors = usePaged(
    filteredVendors,
    `v-${filteredVendors.length}-${q}`,
  );
  const pagedClients = usePaged(
    filteredClients,
    `c-${filteredClients.length}-${q}`,
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
  }

  async function shopAction(
    shopId: string,
    action: "activate" | "deactivate" | "hide_products" | "activate_products",
  ) {
    setBusyId(shopId);
    try {
      await api("/api/admin/vendors", {
        method: "PATCH",
        body: JSON.stringify({ shopId, action }),
      });
      showToast(
        action === "activate"
          ? "Boutique réactivée"
          : action === "deactivate"
            ? "Boutique désactivée"
            : action === "hide_products"
              ? "Produits archivés"
              : "Produits republiés",
        "success",
      );
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Action impossible",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function archiveClient(row: Client) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
      });
      showToast("Client archivé", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Archivage impossible",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function unarchiveClient(row: Client) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "unarchive" }),
      });
      showToast("Client réactivé", "success");
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Réactivation impossible",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(userId: string, label: string) {
    Alert.alert(
      "Réinitialiser le mot de passe ?",
      `Envoyer un nouveau mot de passe à ${label} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          onPress: () => {
            void (async () => {
              setBusyId(userId);
              try {
                await api(`/api/admin/users/${userId}/reset-password`, {
                  method: "POST",
                });
                showToast("Mot de passe réinitialisé", "success");
              } catch (cause) {
                showToast(
                  cause instanceof Error ? cause.message : "Reset impossible",
                  "error",
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  }

  async function saveEdit() {
    if (!editing) return;
    if (editing.name.trim().length < 2) {
      showToast("Nom trop court", "error");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          name: editing.name.trim(),
          email: editing.email.trim(),
          phone: editing.phone.trim() || null,
        }),
      });
      if (
        isOrgOwner &&
        editing.memberId &&
        editing.role !== "owner" &&
        (editing.role === "member" || editing.role === "admin")
      ) {
        await api("/api/org/members", {
          method: "PATCH",
          body: JSON.stringify({
            memberId: editing.memberId,
            role: editing.role,
          }),
        });
      }
      showToast("Profil mis à jour", "success");
      setEditing(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["org-members-role"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeRoleQuick(memberId: string, role: "member" | "admin") {
    if (!isOrgOwner) return;
    setBusyId(memberId);
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
      setBusyId(null);
    }
  }

  async function toggleLiveAccess(
    memberId: string,
    liveAccess: boolean,
    rowId: string,
  ) {
    if (!isOrgOwner) {
      showToast("Seul l'owner peut accorder l'accès live", "error");
      return;
    }
    setBusyId(rowId);
    try {
      await api("/api/org/members", {
        method: "PATCH",
        body: JSON.stringify({ memberId, liveAccess }),
      });
      showToast(
        liveAccess ? "Accès live accordé" : "Accès live retiré",
        "success",
      );
      setEditing((prev) =>
        prev && prev.memberId === memberId
          ? { ...prev, liveAccessGranted: liveAccess }
          : prev,
      );
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Accès live non modifié",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => safeBack()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
            {t("back")}
          </Text>
        </Pressable>

        <View>
          <Text style={[styles.title, { color: c.text }]}>
            Vendeurs & clients
          </Text>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Clients = comptes sans boutique · Vendeurs = propriétaires
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
        ) : vendorsQ.isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
        ) : vendorsQ.isError ? (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <Text style={[styles.empty, { color: c.textMuted }]}>
              {vendorsQ.error instanceof Error &&
              /403|Réservé|refusé/i.test(vendorsQ.error.message)
                ? "Accès refusé — réservé à l'owner / admin plateforme."
                : vendorsQ.error instanceof Error
                  ? vendorsQ.error.message
                  : "API indisponible."}
            </Text>
            <Pressable
              onPress={() => void vendorsQ.refetch()}
              style={[
                styles.miniBtn,
                {
                  alignSelf: "center",
                  borderColor: HAIRLINE,
                  backgroundColor: c.card,
                },
              ]}
            >
              <Text style={{ color: c.primary, fontWeight: "800" }}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              {(
                [
                  ["vendors", `Vendeurs (${vendors.length})`],
                  ["clients", `Clients (${clients.length})`],
                ] as const
              ).map(([key, label]) => {
                const on = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[
                      styles.tab,
                      on
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
                        color: on ? c.primaryForeground : c.textMuted,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={
                tab === "vendors"
                  ? "Filtrer boutique, vendeur, email…"
                  : "Filtrer client, email, téléphone…"
              }
              placeholderTextColor={c.textMuted}
              style={[
                styles.search,
                {
                  color: c.text,
                  backgroundColor: c.card,
                  borderColor: HAIRLINE,
                },
              ]}
            />

            {tab === "vendors" ? (
              <>
                {pagedVendors.visible.map((v) => {
                  const busy = busyId === v.id;
                  const kyc = v.owner?.kyc?.status ?? "NONE";
                  return (
                    <View
                      key={v.id}
                      style={[
                        styles.card,
                        {
                          backgroundColor: c.card,
                          borderColor: HAIRLINE,
                          opacity: v.isActive ? 1 : 0.85,
                        },
                      ]}
                    >
                      <View style={styles.rowTop}>
                        <View
                          style={[
                            styles.avatar,
                            {
                              backgroundColor: v.isActive
                                ? `${c.primary}22`
                                : "#E5484D22",
                            },
                          ]}
                        >
                          <Ionicons
                            name="storefront-outline"
                            size={22}
                            color={v.isActive ? c.primary : "#E5484D"}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text
                            style={[styles.cardTitle, { color: c.text }]}
                            numberOfLines={1}
                          >
                            {v.name}
                          </Text>
                          <View style={styles.badges}>
                            <Badge
                              label="Vendeur"
                              bg={`${c.primary}22`}
                              fg={c.primary}
                            />
                            <Badge
                              label={v.isActive ? "Active" : "Désactivée"}
                              bg={v.isActive ? `${c.emerald}22` : "#E5484D22"}
                              fg={v.isActive ? c.emerald : "#E5484D"}
                            />
                            <Badge
                              label={`KYC ${kyc}`}
                              bg={
                                kyc === "APPROVED"
                                  ? `${c.emerald}22`
                                  : kyc === "PENDING"
                                    ? "rgba(245,158,11,0.18)"
                                    : kyc === "REJECTED"
                                      ? "#E5484D22"
                                      : `${c.text}18`
                              }
                              fg={
                                kyc === "APPROVED"
                                  ? c.emerald
                                  : kyc === "PENDING"
                                    ? "#F59E0B"
                                    : kyc === "REJECTED"
                                      ? "#E5484D"
                                      : c.text
                              }
                            />
                            {v.owner?.liveAccessGranted ? (
                              <Badge
                                label="Live"
                                bg="rgba(255,45,69,0.15)"
                                fg="#ff2d45"
                              />
                            ) : null}
                          </View>
                          <Text
                            style={{ color: c.textMuted, fontSize: 11 }}
                            numberOfLines={2}
                          >
                            @{v.slug}
                            {v.owner
                              ? ` · ${v.owner.name} · ${v.owner.email}`
                              : ""}
                            {v.owner?.phone ? ` · ${v.owner.phone}` : ""}
                          </Text>
                          <Text style={{ color: c.textMuted, fontSize: 11 }}>
                            {v.productsCount} produit(s)
                            {v.productsByStatus?.ACTIVE
                              ? ` · ${v.productsByStatus.ACTIVE} actifs`
                              : ""}
                            {` · ${v.ordersCount} commande(s)`}
                            {v.owner
                              ? ` · Solde ${formatMoney(v.owner.walletBalanceCents, "USD")}`
                              : ""}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.actions}>
                        {v.isActive ? (
                          <MiniBtn
                            c={c}
                            danger
                            disabled={busy}
                            label="Désactiver"
                            onPress={() =>
                              Alert.alert(
                                "Désactiver la boutique ?",
                                `Désactiver « ${v.name} » et archiver ses produits ?`,
                                [
                                  { text: "Annuler", style: "cancel" },
                                  {
                                    text: "Désactiver",
                                    style: "destructive",
                                    onPress: () =>
                                      void shopAction(v.id, "deactivate"),
                                  },
                                ],
                              )
                            }
                          />
                        ) : (
                          <MiniBtn
                            c={c}
                            filled
                            disabled={busy}
                            label="Réactiver"
                            onPress={() => void shopAction(v.id, "activate")}
                          />
                        )}
                        <MiniBtn
                          c={c}
                          disabled={busy || v.productsCount === 0}
                          label="Archiver produits"
                          onPress={() => void shopAction(v.id, "hide_products")}
                        />
                        <MiniBtn
                          c={c}
                          disabled={busy || v.productsCount === 0}
                          label="Republier"
                          onPress={() =>
                            void shopAction(v.id, "activate_products")
                          }
                        />
                        {v.owner ? (
                          <>
                            <MiniBtn
                              c={c}
                              disabled={busy}
                              label="Nom / contact"
                              onPress={() =>
                                setEditing({
                                  id: v.owner!.id,
                                  memberId: v.owner!.memberId ?? null,
                                  name: v.owner!.name,
                                  email: v.owner!.email,
                                  phone: v.owner!.phone ?? "",
                                  role: v.owner!.role ?? "member",
                                  liveAccessGranted: Boolean(
                                    v.owner!.liveAccessGranted,
                                  ),
                                  kind: "vendor-owner",
                                })
                              }
                            />
                            {isOrgOwner &&
                            v.owner.memberId &&
                            v.owner.role !== "owner" ? (
                              <>
                                {(["member", "admin"] as const).map((role) => (
                                  <MiniBtn
                                    key={role}
                                    c={c}
                                    filled={
                                      (v.owner!.role ?? "member") === role
                                    }
                                    disabled={busy}
                                    label={role}
                                    onPress={() =>
                                      void changeRoleQuick(
                                        v.owner!.memberId!,
                                        role,
                                      )
                                    }
                                  />
                                ))}
                                <MiniBtn
                                  c={c}
                                  filled={Boolean(v.owner.liveAccessGranted)}
                                  disabled={busy}
                                  label={
                                    v.owner.liveAccessGranted
                                      ? "Live on"
                                      : "Accès live"
                                  }
                                  onPress={() =>
                                    void toggleLiveAccess(
                                      v.owner!.memberId!,
                                      !v.owner!.liveAccessGranted,
                                      v.id,
                                    )
                                  }
                                />
                              </>
                            ) : null}
                            <MiniBtn
                              c={c}
                              disabled={busy}
                              label="Reset MDP"
                              onPress={() =>
                                resetPassword(
                                  v.owner!.id,
                                  `${v.owner!.name} (${v.owner!.email})`,
                                )
                              }
                            />
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {filteredVendors.length === 0 ? (
                  <Text style={[styles.empty, { color: c.textMuted }]}>
                    Aucun vendeur
                  </Text>
                ) : (
                  <PagedMore
                    hasMore={pagedVendors.hasMore}
                    remaining={pagedVendors.remaining}
                    onMore={pagedVendors.more}
                  />
                )}
              </>
            ) : (
              <>
                {pagedClients.visible.map((row) => {
                  const busy = busyId === row.id || busyId === row.memberId;
                  return (
                    <View
                      key={row.id}
                      style={[
                        styles.card,
                        { backgroundColor: c.card, borderColor: HAIRLINE },
                      ]}
                    >
                      <View style={styles.rowTop}>
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: `${c.textMuted}18` },
                          ]}
                        >
                          <Ionicons
                            name="person-outline"
                            size={22}
                            color={c.textMuted}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text
                            style={[styles.cardTitle, { color: c.text }]}
                            numberOfLines={1}
                          >
                            {row.name}
                          </Text>
                          <View style={styles.badges}>
                            <Badge
                              label="Client"
                              bg={`${c.textMuted}22`}
                              fg={c.textMuted}
                            />
                            <Badge
                              label={row.role}
                              bg={`${c.primary}18`}
                              fg={c.primary}
                            />
                            {row.liveAccessGranted ? (
                              <Badge
                                label="Live"
                                bg="rgba(255,45,69,0.15)"
                                fg="#ff2d45"
                              />
                            ) : null}
                            {row.disabledAt ? (
                              <Badge
                                label="Archivé"
                                bg="#E5484D22"
                                fg="#E5484D"
                              />
                            ) : null}
                          </View>
                          <Text
                            style={{ color: c.textMuted, fontSize: 11 }}
                            numberOfLines={2}
                          >
                            {row.email}
                            {row.phone ? ` · ${row.phone}` : ""}
                          </Text>
                          <Text style={{ color: c.textMuted, fontSize: 11 }}>
                            {row.ordersCount} commande(s) · Solde{" "}
                            {formatMoney(row.walletBalanceCents, "USD")}
                          </Text>
                        </View>
                      </View>

                      {isOrgOwner && row.role !== "owner" ? (
                        <View style={[styles.actions, { marginBottom: 4 }]}>
                          {(["member", "admin"] as const).map((role) => (
                            <MiniBtn
                              key={role}
                              c={c}
                              filled={row.role === role}
                              disabled={busy}
                              label={role}
                              onPress={() =>
                                void changeRoleQuick(row.memberId, role)
                              }
                            />
                          ))}
                          <MiniBtn
                            c={c}
                            filled={Boolean(row.liveAccessGranted)}
                            disabled={busy}
                            label={
                              row.liveAccessGranted ? "Live on" : "Accès live"
                            }
                            onPress={() =>
                              void toggleLiveAccess(
                                row.memberId,
                                !row.liveAccessGranted,
                                row.id,
                              )
                            }
                          />
                        </View>
                      ) : null}

                      <View style={styles.actions}>
                        <MiniBtn
                          c={c}
                          disabled={busy}
                          label="Modifier"
                          onPress={() =>
                            setEditing({
                              id: row.id,
                              memberId: row.memberId,
                              name: row.name,
                              email: row.email,
                              phone: row.phone ?? "",
                              role: row.role,
                              liveAccessGranted: Boolean(row.liveAccessGranted),
                              kind: "client",
                            })
                          }
                        />
                        {row.disabledAt ? (
                          <MiniBtn
                            c={c}
                            filled
                            disabled={busy}
                            label="Réactiver"
                            onPress={() => void unarchiveClient(row)}
                          />
                        ) : (
                          <MiniBtn
                            c={c}
                            disabled={busy}
                            label="Archiver"
                            onPress={() =>
                              Alert.alert(
                                "Archiver le client ?",
                                "La connexion sera bloquée.",
                                [
                                  { text: "Annuler", style: "cancel" },
                                  {
                                    text: "Archiver",
                                    onPress: () => void archiveClient(row),
                                  },
                                ],
                              )
                            }
                          />
                        )}
                        <MiniBtn
                          c={c}
                          disabled={busy}
                          label="Reset MDP"
                          onPress={() =>
                            resetPassword(row.id, `${row.name} (${row.email})`)
                          }
                        />
                      </View>
                    </View>
                  );
                })}
                {filteredClients.length === 0 ? (
                  <Text style={[styles.empty, { color: c.textMuted }]}>
                    Aucun client
                  </Text>
                ) : (
                  <PagedMore
                    hasMore={pagedClients.hasMore}
                    remaining={pagedClients.remaining}
                    onMore={pagedClients.more}
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(editing)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable style={styles.modalBg} onPress={() => setEditing(null)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: c.sheet ?? c.card,
                borderColor: HAIRLINE,
                paddingBottom: insets.bottom + 16,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {editing?.kind === "vendor-owner"
                ? "Modifier le vendeur"
                : "Modifier le client"}
            </Text>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Nom</Text>
            <TextInput
              value={editing?.name ?? ""}
              onChangeText={(name) =>
                setEditing((prev) => (prev ? { ...prev, name } : prev))
              }
              style={[
                styles.field,
                {
                  color: c.text,
                  borderColor: HAIRLINE,
                  backgroundColor: c.card,
                },
              ]}
            />
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
              E-mail
            </Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={editing?.email ?? ""}
              onChangeText={(email) =>
                setEditing((prev) => (prev ? { ...prev, email } : prev))
              }
              style={[
                styles.field,
                {
                  color: c.text,
                  borderColor: HAIRLINE,
                  backgroundColor: c.card,
                },
              ]}
            />
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
              Téléphone
            </Text>
            <TextInput
              keyboardType="phone-pad"
              value={editing?.phone ?? ""}
              onChangeText={(phone) =>
                setEditing((prev) => (prev ? { ...prev, phone } : prev))
              }
              style={[
                styles.field,
                {
                  color: c.text,
                  borderColor: HAIRLINE,
                  backgroundColor: c.card,
                },
              ]}
            />

            {isOrgOwner && editing?.memberId && editing.role !== "owner" ? (
              <>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
                  Rôle (owner uniquement)
                </Text>
                <View style={styles.actions}>
                  {(["member", "admin"] as const).map((role) => (
                    <MiniBtn
                      key={role}
                      c={c}
                      filled={editing.role === role}
                      label={role}
                      onPress={() =>
                        setEditing((prev) => (prev ? { ...prev, role } : prev))
                      }
                    />
                  ))}
                </View>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
                  Accès live boutique
                </Text>
                <View style={styles.actions}>
                  <MiniBtn
                    c={c}
                    filled={editing.liveAccessGranted}
                    label={
                      editing.liveAccessGranted
                        ? "Live accordé — retirer"
                        : "Accorder l'accès live"
                    }
                    onPress={() =>
                      void toggleLiveAccess(
                        editing.memberId!,
                        !editing.liveAccessGranted,
                        editing.id,
                      )
                    }
                  />
                </View>
              </>
            ) : null}

            <View style={[styles.actions, { marginTop: 16 }]}>
              <MiniBtn c={c} label="Annuler" onPress={() => setEditing(null)} />
              <MiniBtn
                c={c}
                filled
                disabled={saving}
                label={saving ? "…" : "Enregistrer"}
                onPress={() => void saveEdit()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
  },
  backText: { fontWeight: "700", includeFontPadding: false },
  title: { fontSize: 24, fontWeight: "800" },
  lead: { fontSize: 12, marginTop: 4 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: "center",
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  rowTop: { flexDirection: "row", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: "center",
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
  empty: { textAlign: "center", paddingVertical: 28, fontSize: 14 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
});
