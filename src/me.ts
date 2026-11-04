import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useSession } from "@/src/session";

const LIVE_ROLES = new Set(["SELLER", "VENDEUR", "VENDOR", "OWNER", "ADMIN"]);

function pushRole(into: Set<string>, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    into.add(value.trim().toUpperCase());
  }
}

function collectRoles(payload: Record<string, unknown> | null | undefined) {
  const roles = new Set<string>();
  if (!payload) return roles;
  pushRole(roles, payload.role);
  if (Array.isArray(payload.roles)) {
    for (const item of payload.roles) pushRole(roles, item);
  }
  const user = payload.user;
  if (user && typeof user === "object") {
    const record = user as Record<string, unknown>;
    pushRole(roles, record.role);
    if (Array.isArray(record.roles)) {
      for (const item of record.roles) pushRole(roles, item);
    }
    if (record.isAdmin === true) roles.add("ADMIN");
    if (record.isSeller === true || record.seller === true) roles.add("SELLER");
    if (record.isOwner === true) roles.add("OWNER");
  }
  if (payload.isAdmin === true) roles.add("ADMIN");
  if (payload.isSeller === true) roles.add("SELLER");
  return roles;
}

function collectId(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;
  const user = payload.user;
  if (user && typeof user === "object") {
    const id = (user as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  const data = payload.data;
  if (data && typeof data === "object") {
    const nested = collectId(data as Record<string, unknown>);
    if (nested) return nested;
  }
  const session = payload.session;
  if (session && typeof session === "object") {
    const nested = collectId(session as Record<string, unknown>);
    if (nested) return nested;
  }
  if (typeof payload.id === "string") return payload.id;
  return null;
}

export type Me = {
  id: string | null;
  roles: string[];
  shopIds: string[];
  canSeeGoLive: boolean;
};

export function useMe() {
  const token = useSession((state) => state.token);
  return useQuery({
    queryKey: ["me", token ?? "guest"],
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: async (): Promise<Me> => {
      const [session, profile, shops] = await Promise.all([
        api<Record<string, unknown>>("/api/auth/get-session").catch(() => null),
        api<Record<string, unknown>>("/api/profile").catch(() => null),
        api<{ shops?: { id?: string }[] }>("/api/shops?mine=1").catch(
          () => null,
        ),
      ]);
      const roles = new Set<string>();
      for (const role of collectRoles(session)) roles.add(role);
      for (const role of collectRoles(profile)) roles.add(role);
      const id = collectId(session) ?? collectId(profile);
      const shopIds = (shops?.shops ?? [])
        .map((shop) => shop.id)
        .filter((shopId): shopId is string => typeof shopId === "string");
      if (shopIds.length) roles.add("SELLER");
      const list = [...roles];
      return {
        id,
        roles: list,
        shopIds,
        canSeeGoLive: list.some((role) => LIVE_ROLES.has(role)),
      };
    },
  });
}

export function isSellerOfShop(
  me: Me | undefined,
  shop: { id: string; ownerUserId?: string | null },
) {
  if (!me) return false;
  if (me.id && shop.ownerUserId && me.id === shop.ownerUserId) return true;
  return me.shopIds.includes(shop.id);
}
