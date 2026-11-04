export type LiveChat = {
  id: string;
  body: string;
  user: { id: string; name: string; image?: string | null };
};

export type LiveGuest = {
  id: string;
  status: "PENDING" | "INVITED" | "ON_STAGE" | "REFUSED" | "LEFT" | string;
  cameraOn?: boolean;
  micOn?: boolean;
  handRaised?: boolean;
  hasFloor?: boolean;
  user: { id: string; name: string; image?: string | null };
};

export function matchOpenLive<
  T extends {
    status?: string;
    product?: { id?: string } | null;
    user?: { id?: string };
  },
>(
  lives: T[] | undefined,
  opts: { productId?: string | null; ownerUserId?: string | null },
): T | null {
  const open = (lives ?? []).filter((row) => row.status !== "ENDED");
  if (!open.length) return null;
  const liveNow = open.filter((row) => !row.status || row.status === "LIVE");
  const pool = liveNow.length ? liveNow : open;
  if (opts.productId) {
    const hit = pool.find((row) => row.product?.id === opts.productId);
    if (hit) return hit;
  }
  if (opts.ownerUserId) {
    return pool.find((row) => row.user?.id === opts.ownerUserId) ?? null;
  }
  return pool[0] ?? null;
}

export type LiveDetail = {
  id: string;
  title: string;
  status: "LIVE" | "PAUSED" | "ENDED" | string;
  giftCents?: number;
  likeCount?: number;
  viewerPeak?: number;
  startedAt?: string;
  pausedAt?: string | null;
  statusMessage?: string | null;
  cameraOn?: boolean;
  micOn?: boolean;
  sfu?: boolean;
  plannedMinutes?: number;
  pauseTimeoutMs?: number;
  pauseReason?: string | null;
  backdropUrl?: string | null;
  user?: { id: string; name?: string | null; image?: string | null };
  product?: {
    id: string;
    title: string;
    description?: string | null;
    images: string[];
    priceCents: number;
    currency?: string;
    shop?: {
      id?: string;
      name?: string;
      slug?: string;
      logoUrl?: string | null;
    };
  } | null;
  chats?: LiveChat[];
  guests?: LiveGuest[];
  myGuest?: LiveGuest | null;
  guestJoinLocked?: boolean;
  overlays?: LiveOverlay[];
  catalogOpen?: boolean;
  presentedProductId?: string | null;
  catalogScrollY?: number;
  lastGiftBurst?: { id: string; amountCents: number } | null;
  catalogProducts?: {
    id: string;
    title: string;
    description?: string | null;
    images: string[];
    priceCents: number;
    currency?: string;
    shop?: { id?: string; name?: string; slug?: string };
  }[];
};

export type LiveOverlay =
  | {
      id: string;
      kind: "catalog";
      presentedProductId?: string | null;
    }
  | {
      id: string;
      kind: "product";
      productId: string;
      title: string;
      image?: string | null;
      priceCents: number;
      currency?: string;
      note?: string;
    }
  | {
      id: string;
      kind: "text";
      text: string;
    };

export type LiveSfuToken = {
  token: string;
  url: string;
  canPublish?: boolean;
  sfu?: boolean;
};

export function formatLiveClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
