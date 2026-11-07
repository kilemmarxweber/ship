import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
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

import { ParcelMap } from "@/components/orders/ParcelMap";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { watchDeviceCoords } from "@/src/geo";
import { statusLabel } from "@/src/orders";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

type Job = {
  id: string;
  status: string;
  shippingCents: number;
  shippingFeeCents?: number;
  deliveryAddress: string | null;
  deliveryCommune: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  product: { title: string; images: string[] };
  shop: { name: string };
  buyer?: { name?: string | null; phone?: string | null };
};

type CourierMe = {
  courier?: {
    id: string;
    name?: string;
    lat?: number;
    lng?: number;
    lastLat?: number | null;
    lastLng?: number | null;
  };
  jobs?: Job[];
  wallet?: { currency?: string; courierCents?: number };
};

export function CourierScreen() {
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["courier-me", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<CourierMe>("/api/courier/me"),
    refetchInterval: 4000,
    retry: false,
  });

  const courier = me.data?.courier;
  const jobs = me.data?.jobs ?? [];
  const open = jobs.find((job) => job.id === openId) ?? jobs[0] ?? null;
  const onTheWay = jobs.some((job) => job.status === "OUT_FOR_DELIVERY");

  useEffect(() => {
    if (!courier?.id || !onTheWay) return;
    return watchDeviceCoords((coords) => {
      void api(`/api/couriers/${courier.id}/location`, {
        method: "POST",
        body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
      }).catch(() => undefined);
    });
  }, [courier?.id, onTheWay]);

  const here = useMemo(() => {
    if (!courier) return null;
    if (
      typeof courier.lastLat === "number" &&
      typeof courier.lastLng === "number"
    ) {
      return { lat: courier.lastLat, lng: courier.lastLng };
    }
    if (typeof courier.lat === "number" && typeof courier.lng === "number") {
      return { lat: courier.lat, lng: courier.lng };
    }
    return null;
  }, [courier]);

  async function depart(orderId: string) {
    setBusyId(orderId);
    try {
      await api(`/api/courier/jobs/${orderId}/depart`, { method: "POST" });
      showToast("En route", "success");
      await me.refetch();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Impossible de partir",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Courses</Text>
        <Pressable style={styles.cta} onPress={openAuth}>
          <Text style={styles.ctaText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (me.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (!courier) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.back} onPress={() => safeBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.backText} numberOfLines={1}>
            Retour{"\u00A0"}
          </Text>
        </Pressable>
        <Text style={styles.title}>Courses</Text>
        <Text style={styles.empty}>
          Aucun compte livreur lié à cet utilisateur.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Pressable style={styles.back} onPress={() => safeBack()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
        <Text style={styles.backText} numberOfLines={1}>
          Retour{"\u00A0"}
        </Text>
      </Pressable>
      <Text style={styles.title}>Courses</Text>
      <View style={styles.wallet}>
        <Text style={styles.walletLabel}>Pot courses</Text>
        <Text style={styles.walletValue}>
          {formatMoney(me.data?.wallet?.courierCents ?? 0)}
        </Text>
      </View>

      {jobs.map((job) => {
        const net = Math.max(
          0,
          job.shippingCents - (job.shippingFeeCents || 50),
        );
        const selected = open?.id === job.id;
        const canGo = ["ASSIGNED", "FULFILLING"].includes(job.status);
        return (
          <Pressable
            key={job.id}
            style={[styles.job, selected && styles.jobOn]}
            onPress={() => setOpenId(job.id)}
          >
            <Text style={styles.jobTitle}>{job.product.title}</Text>
            <Text style={styles.meta}>
              {job.shop.name} · {statusLabel(job.status)}
            </Text>
            <Text style={styles.meta}>Net {formatMoney(net)}</Text>
            {job.deliveryAddress ? (
              <Text style={styles.meta}>{job.deliveryAddress}</Text>
            ) : null}
            {canGo ? (
              <Pressable
                style={styles.go}
                disabled={busyId === job.id}
                onPress={() => void depart(job.id)}
              >
                <Ionicons name="bicycle" size={18} color="#04281c" />
                <Text style={styles.goText}>
                  {busyId === job.id ? "…" : "Je pars"}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}

      {jobs.length === 0 ? (
        <Text style={styles.empty}>Aucune course en cours</Text>
      ) : null}

      {open && open.deliveryLat != null && open.deliveryLng != null ? (
        <ParcelMap
          mode="courier"
          live={open.status === "OUT_FOR_DELIVERY"}
          courier={here}
          destination={{ lat: open.deliveryLat, lng: open.deliveryLng }}
          label={open.status === "OUT_FOR_DELIVERY" ? "En route" : "Trajet"}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  empty: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  wallet: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 16,
  },
  walletLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  walletValue: { color: colors.emerald, fontSize: 28, fontWeight: "800" },
  job: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    gap: 4,
  },
  jobOn: { borderColor: "rgba(0,214,143,0.45)" },
  jobTitle: { color: "#fff", fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  go: {
    marginTop: 8,
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  goText: { color: "#04281c", fontWeight: "800" },
  cta: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#04281c", fontWeight: "800" },
});
