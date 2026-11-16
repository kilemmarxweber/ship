import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

const PAGES = {
  products: {
    title: "Modération produits",
    path: "/api/admin/products?limit=100",
  },
  vendors: {
    title: "Vendeurs & clients",
    path: "/api/admin/vendors",
  },
  ledger: {
    title: "Ledger paiements",
    path: "/api/admin/ledger?limit=100",
  },
  attention: {
    title: "KPI attention",
    path: "/api/admin/attention-kpis",
  },
  campaigns: {
    title: "Stories partenaires",
    path: "/api/admin/brand-campaigns",
  },
  challenges: {
    title: "Challenges",
    path: "/api/admin/challenges",
  },
  expansion: {
    title: "Playbook expansion",
    path: "/api/admin/expansion-playbook",
  },
  content: {
    title: "Contenu (Système / Sanity)",
    path: "/api/admin/content-source",
  },
  moderation: {
    title: "Modération NSFW",
    path: "/api/admin/moderation?limit=100",
  },
} as const;

type PageKey = keyof typeof PAGES;

function rowsFromPayload(page: PageKey, data: Record<string, unknown>) {
  if (page === "products") {
    const products =
      (data.products as {
        id: string;
        title?: string;
        status?: string;
        shop?: { name?: string };
      }[]) ?? [];
    return products.map((p) => ({
      id: p.id,
      title: p.title ?? "Produit",
      meta: `${p.status ?? "—"} · ${p.shop?.name ?? ""}`,
    }));
  }
  if (page === "vendors") {
    const vendors =
      (data.vendors as {
        id: string;
        name?: string;
        email?: string;
        shopsCount?: number;
      }[]) ??
      (data.users as { id: string; name?: string; email?: string }[]) ??
      [];
    return vendors.map((v) => ({
      id: v.id,
      title: v.name ?? "Utilisateur",
      meta: `${v.email ?? ""}${v.shopsCount != null ? ` · ${v.shopsCount} shops` : ""}`,
    }));
  }
  if (page === "ledger") {
    const entries =
      (data.entries as {
        id: string;
        kind?: string;
        amountUsdCents?: number;
        shopName?: string | null;
      }[]) ??
      (data.rows as {
        id: string;
        kind?: string;
        amountUsdCents?: number;
        shopName?: string | null;
      }[]) ??
      [];
    return entries.map((e) => ({
      id: e.id,
      title: e.kind ?? "Mouvement",
      meta: `${formatMoney(e.amountUsdCents ?? 0, "USD")} · ${e.shopName ?? "—"}`,
    }));
  }
  if (page === "attention") {
    const kpis = (data.kpis as Record<string, number | string>) ?? data;
    return Object.entries(kpis).map(([key, value]) => ({
      id: key,
      title: key,
      meta: String(value),
    }));
  }
  if (page === "campaigns") {
    const campaigns =
      (data.campaigns as {
        id: string;
        title?: string;
        name?: string;
        status?: string;
      }[]) ?? [];
    return campaigns.map((row) => ({
      id: row.id,
      title: row.title ?? row.name ?? "Campagne",
      meta: row.status ?? "—",
    }));
  }
  if (page === "challenges") {
    const challenges =
      (data.challenges as { id: string; title?: string; status?: string }[]) ??
      [];
    return challenges.map((row) => ({
      id: row.id,
      title: row.title ?? "Challenge",
      meta: row.status ?? "—",
    }));
  }
  if (page === "expansion") {
    const steps =
      (data.steps as { id?: string; title?: string; body?: string }[]) ??
      (data.playbook as { id?: string; title?: string; body?: string }[]) ??
      [];
    if (steps.length === 0 && data.markdown) {
      return [
        {
          id: "playbook",
          title: "Playbook",
          meta: String(data.markdown).slice(0, 180),
        },
      ];
    }
    return steps.map((row, index) => ({
      id: row.id ?? `step-${index}`,
      title: row.title ?? `Étape ${index + 1}`,
      meta: row.body?.slice(0, 120) ?? "—",
    }));
  }
  if (page === "content") {
    return [
      {
        id: "source",
        title: "Source contenu",
        meta: JSON.stringify(data).slice(0, 180),
      },
    ];
  }
  const items =
    (data.items as { id: string; status?: string; reason?: string }[]) ??
    (data.reports as { id: string; status?: string; reason?: string }[]) ??
    [];
  return items.map((row) => ({
    id: row.id,
    title: row.reason ?? "Signalement",
    meta: row.status ?? "—",
  }));
}

export function SellerAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const params = useLocalSearchParams<{ page?: string }>();
  const page = (
    typeof params.page === "string" && params.page in PAGES
      ? params.page
      : "products"
  ) as PageKey;
  const meta = PAGES[page];

  const q = useQuery({
    queryKey: ["seller-admin", page, token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<Record<string, unknown>>(meta.path),
    retry: false,
  });

  const [extraRows, setExtraRows] = useState<
    { id: string; title: string; meta: string }[]
  >([]);
  const [cursorOverride, setCursorOverride] = useState<
    string | null | undefined
  >(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const baseRows = useMemo(
    () => (q.data ? rowsFromPayload(page, q.data) : []),
    [q.data, page],
  );
  const cursorFromQuery =
    typeof q.data?.nextCursor === "string" ? q.data.nextCursor : null;
  const rows = useMemo(() => {
    if (extraRows.length === 0) return baseRows;
    const seen = new Set(baseRows.map((row) => row.id));
    return [...baseRows, ...extraRows.filter((row) => !seen.has(row.id))];
  }, [baseRows, extraRows]);
  const paged = usePaged(rows, `${page}-${rows.length}`);
  const moreCursor =
    cursorOverride === undefined ? cursorFromQuery : cursorOverride;

  useEffect(() => {
    setExtraRows([]);
    setCursorOverride(undefined);
  }, [page, q.dataUpdatedAt]);

  async function loadMoreRows() {
    if (!moreCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const joiner = meta.path.includes("?") ? "&" : "?";
      const data = await api<Record<string, unknown>>(
        `${meta.path}${joiner}cursor=${encodeURIComponent(moreCursor)}`,
      );
      setExtraRows((prev) => [...prev, ...rowsFromPayload(page, data)]);
      setCursorOverride(
        typeof data.nextCursor === "string" ? data.nextCursor : null,
      );
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Page suivante indisponible",
        "error",
      );
    } finally {
      setLoadingMore(false);
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
    >
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>{meta.title}</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Espace owner — même données que le shop web
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
      ) : q.isError ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Accès refusé ou API indisponible.
        </Text>
      ) : rows.length === 0 ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Aucune donnée
        </Text>
      ) : (
        <>
          {paged.visible.map((row) => (
            <View
              key={row.id}
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: HAIRLINE },
              ]}
            >
              <Text
                style={{ color: c.text, fontWeight: "800" }}
                numberOfLines={2}
              >
                {row.title}
              </Text>
              <Text
                style={{ color: c.textMuted, fontSize: 12 }}
                numberOfLines={3}
              >
                {row.meta}
              </Text>
            </View>
          ))}
          <PagedMore
            hasMore={paged.hasMore}
            remaining={paged.remaining}
            onMore={paged.more}
          />
          {!paged.hasMore && moreCursor ? (
            <Pressable
              disabled={loadingMore}
              onPress={() => void loadMoreRows()}
              style={[styles.primary, { backgroundColor: c.primary }]}
            >
              <Text
                style={[styles.primaryText, { color: c.primaryForeground }]}
              >
                {loadingMore ? "Chargement…" : "Page suivante"}
              </Text>
            </Pressable>
          ) : null}
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
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
