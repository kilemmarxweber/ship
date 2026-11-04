import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { kvGet, kvSet } from "@/src/offline/db";
import { useSession } from "@/src/session";

export const WANTED_FEED_KEY = ["wanted-feed"] as const;
const WANTED_SINCE_KEY = "wantedChangesSince";

export const WANTED_NO_TRACE =
  "Sans paiement ShipShop, pas de preuve. Pas de trace = pas de remboursement en cas de problème.";

export type WantedOffer = {
  id: string;
  priceCents: number;
  message?: string | null;
  images?: string[];
  condition?: "NEW_SHOP" | "USED";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | string;
  createdAt: string;
  updatedAt?: string;
  shop?: {
    id: string;
    name: string;
    slug?: string;
    lat?: number | null;
    lng?: number | null;
    isOccasionStall?: boolean;
  } | null;
  seller?: { id: string; name: string; image?: string | null } | null;
  kycApproved?: boolean;
  overBudget?: boolean;
  sellerPhone?: string | null;
  sellerCommune?: string | null;
  sellerQuartier?: string | null;
  sellerAddress?: string | null;
  sellerLat?: number | null;
  sellerLng?: number | null;
  mine?: boolean;
};

export type WantedListItem = {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  budgetCents: number;
  currency?: string;
  condition: "NEW_SHOP" | "USED";
  commune?: string | null;
  category: string;
  status?: string;
  isOwner?: boolean;
  paymentRail?: string | null;
  fulfillmentIntent?: string | null;
  updatedAt?: string;
  _count?: { offers: number };
  buyer?: { id?: string; name: string };
  offers?: WantedOffer[];
};

export type WantedCheckoutResult = {
  ok?: boolean;
  paymentRail?: "SHIPSHOP" | "OFF_PLATFORM";
  orderId?: string;
  handoverId?: string;
  shopId?: string;
  productId?: string;
  orders?: {
    id: string;
    fulfillmentType?: string;
    courierId?: string | null;
  }[];
  tickets?: {
    id: string;
    shopId: string;
    shopName: string;
    code: string;
    qrPayload: string;
    orderIds: string[];
    itemCount: number;
  }[];
};

type WantedChange = {
  requestId: string;
  updatedAt: string;
  changedOfferCount?: number;
};

type WantedChangesPayload = {
  now?: string;
  changes?: WantedChange[];
};

type WantedDetailPayload = {
  request?: WantedListItem & { offers?: WantedOffer[] };
};

export function wantedDetailKey(id: string) {
  return ["wanted", id] as const;
}

function mergeWantedLists(
  mine: WantedListItem[] | undefined,
  published: WantedListItem[] | undefined,
) {
  const own = (mine ?? []).filter(
    (row) => !row.status || row.status === "OPEN",
  );
  const seen = new Set(own.map((row) => row.id));
  return [...own, ...(published ?? []).filter((row) => !seen.has(row.id))];
}

export async function fetchWantedFeed() {
  const published = await api<{ requests?: WantedListItem[] }>("/api/wanted");
  const token = useSession.getState().token;
  if (!token) return { requests: published.requests ?? [] };
  try {
    const mine = await api<{ requests?: WantedListItem[] }>(
      "/api/wanted?mine=1",
    );
    return { requests: mergeWantedLists(mine.requests, published.requests) };
  } catch {
    return { requests: published.requests ?? [] };
  }
}

function toListItem(
  request: WantedListItem & { offers?: WantedOffer[] },
): WantedListItem {
  const offers = request.offers ?? [];
  return {
    ...request,
    offers,
    _count: { offers: offers.length || request._count?.offers || 0 },
  };
}

export function patchWantedFeed(
  queryClient: ReturnType<typeof useQueryClient>,
  request: WantedListItem,
) {
  const next = toListItem(request);
  queryClient.setQueryData<{ requests?: WantedListItem[] }>(
    WANTED_FEED_KEY,
    (current) => {
      const list = current?.requests ?? [];
      const index = list.findIndex((row) => row.id === next.id);
      if (index < 0) {
        if (next.buyer?.id) return { requests: [next, ...list] };
        return current ?? { requests: [next] };
      }
      const copy = [...list];
      copy[index] = { ...copy[index], ...next };
      return { requests: copy };
    },
  );
  queryClient.setQueryData(wantedDetailKey(next.id), { request: next });
}

export async function reloadWantedRequest(
  queryClient: ReturnType<typeof useQueryClient>,
  requestId: string,
) {
  const detail = await api<WantedDetailPayload>(`/api/wanted/${requestId}`);
  if (!detail.request) return;
  patchWantedFeed(queryClient, detail.request);
}

async function pullWantedOfferChanges(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const since = kvGet(WANTED_SINCE_KEY) || new Date(0).toISOString();
  const payload = await api<WantedChangesPayload>(
    `/api/wanted/changes?since=${encodeURIComponent(since)}`,
  );
  const changes = payload.changes ?? [];
  for (const change of changes) {
    await reloadWantedRequest(queryClient, change.requestId);
  }
  if (payload.now) kvSet(WANTED_SINCE_KEY, payload.now);
  return payload;
}

export function useWantedOfferSync(active: boolean) {
  const token = useSession((state) => state.token);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["wanted-changes", token ?? "guest"],
    enabled: Boolean(token) && active,
    staleTime: 4_000,
    refetchInterval: () => (onlineManager.isOnline() ? 8_000 : false),
    refetchIntervalInBackground: false,
    queryFn: () => pullWantedOfferChanges(queryClient),
  });
}

export function useWantedDetail(id: string | undefined) {
  const token = useSession((state) => state.token);
  return useQuery({
    queryKey: [...wantedDetailKey(id ?? ""), token ?? "guest"],
    enabled: Boolean(id),
    queryFn: () => api<WantedDetailPayload>(`/api/wanted/${id}`),
    refetchInterval: () => (onlineManager.isOnline() ? 8_000 : false),
  });
}
