import type { CartItem, CartPayload } from "@/src/cart";
import type {
    InboxComment,
    InboxConversation,
    InboxSnapshot,
} from "@/src/inbox";
import type { CommentItem, FeedPage, Product } from "@/src/types";

export const FEED_CAP = 16;
export const INBOX_CAP = 20;
export const THREAD_CAP = 8;
export const COMMENT_CAP = 20;
export const PRODUCT_COMMENT_CAP = 10;

export type CompactProduct = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  quantity: number;
  shopId: string;
  shopName: string;
  poster: string | null;
  videoUrl: string | null;
};

export type CompactCartLine = {
  productId: string;
  qty: number;
  title: string;
  priceCents: number;
  currency: string;
  poster: string | null;
  shopId: string;
  shopName: string;
};

export type CompactInboxThread = {
  id: string;
  shopId: string;
  shopName: string;
  logoUrl: string | null;
  productTitle: string;
  lastBody: string;
  unread: number;
  urgent: boolean;
  updatedAt: string;
  buyerId: string;
  buyerName: string;
  buyerImage: string | null;
};

export type CompactInboxComment = {
  id: string;
  body: string;
  name: string;
  productId: string;
  productTitle: string;
  unread: boolean;
  createdAt: string;
};

export type CompactInbox = {
  conversations: CompactInboxThread[];
  comments: CompactInboxComment[];
  unreadComments: number;
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender?: { id: string; name: string };
};

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function compactProduct(product: Product): CompactProduct {
  const images = Array.isArray(product.images) ? product.images : [];
  const poster =
    images.find((url) => url && !/\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url)) ??
    images[0] ??
    null;
  const videoUrl =
    images.find((url) => /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url)) ??
    product.soundtrack?.audioUrl ??
    null;
  return {
    id: product.id,
    title: product.title,
    priceCents: num(product.priceCents),
    currency: str(product.currency, "USD"),
    quantity: Math.max(0, num(product.quantity ?? product.soldCount, 0)),
    shopId: str(product.shop?.id, "shop"),
    shopName: str(product.shop?.name, "Boutique"),
    poster,
    videoUrl,
  };
}

export function expandProduct(row: CompactProduct): Product {
  const images = [row.poster, row.videoUrl].filter((url): url is string =>
    Boolean(url),
  );
  return {
    id: row.id,
    title: row.title,
    description: null,
    priceCents: row.priceCents,
    currency: row.currency,
    quantity: row.quantity,
    status: "ACTIVE",
    images,
    colors: [],
    sizes: [],
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
    shop: {
      id: row.shopId,
      name: row.shopName,
      slug: "",
    },
  };
}

export function compactFeedPages(pages: FeedPage[] | undefined) {
  const products = (pages ?? [])
    .flatMap((page) => page.products)
    .slice(0, FEED_CAP)
    .map(compactProduct);
  return { products };
}

export function expandFeedPages(
  compact: { products?: CompactProduct[] } | null,
) {
  const products = (compact?.products ?? [])
    .slice(0, FEED_CAP)
    .map(expandProduct);
  return {
    pages: [{ products, nextCursor: null }] satisfies FeedPage[],
    pageParams: [""],
  };
}

export function compactCart(payload: CartPayload): CompactCartLine[] {
  return payload.items.slice(0, 40).map((item) => ({
    productId: item.productId,
    qty: item.quantity,
    title: item.product.title,
    priceCents: item.product.priceCents,
    currency: item.product.currency ?? "USD",
    poster: item.product.images[0] ?? null,
    shopId: item.product.shop.id,
    shopName: item.product.shop.name,
  }));
}

export function expandCart(lines: CompactCartLine[] | null): CartPayload {
  const items: CartItem[] = (lines ?? []).map((line) => ({
    id: line.productId,
    productId: line.productId,
    quantity: Math.max(1, line.qty),
    product: {
      id: line.productId,
      title: line.title,
      priceCents: line.priceCents,
      currency: line.currency,
      images: line.poster ? [line.poster] : [],
      shop: { id: line.shopId, name: line.shopName, slug: "" },
    },
  }));
  const totalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );
  return { items, totalCents, count: items.length };
}

export function compactInbox(snapshot: InboxSnapshot): CompactInbox {
  const conversations = snapshot.conversations
    .slice(0, INBOX_CAP)
    .map((row) => {
      const last = row.messages?.[row.messages.length - 1];
      return {
        id: row.id,
        shopId: row.shop.id,
        shopName: row.shop.name,
        logoUrl: row.shop.logoUrl ?? null,
        productTitle: row.product?.title ?? row.wantedRequest?.title ?? "",
        lastBody: last?.body ?? "",
        unread: row.unreadCount ?? 0,
        urgent: Boolean(row.urgentPending),
        updatedAt: row.updatedAt,
        buyerId: row.buyer.id,
        buyerName: row.buyer.name,
        buyerImage: row.buyer.image ?? null,
      };
    });
  return {
    conversations,
    comments: snapshot.comments.slice(0, COMMENT_CAP).map((row) => ({
      id: row.id,
      body: row.body,
      name: row.user.name,
      productId: row.product.id,
      productTitle: row.product.title,
      unread: row.unread,
      createdAt: row.createdAt,
    })),
    unreadComments: snapshot.unreadComments,
  };
}

export function expandInbox(
  compact: CompactInbox | null,
): InboxSnapshot | null {
  if (!compact) return null;
  const conversations: InboxConversation[] = (compact.conversations ?? []).map(
    (row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
      urgentPending: row.urgent,
      unreadCount: row.unread,
      shop: {
        id: row.shopId,
        name: row.shopName,
        logoUrl: row.logoUrl,
      },
      product: row.productTitle
        ? { id: "cached", title: row.productTitle, images: [] }
        : null,
      buyer: {
        id: row.buyerId,
        name: row.buyerName,
        image: row.buyerImage,
      },
      messages: row.lastBody
        ? [
            {
              body: row.lastBody,
              createdAt: row.updatedAt,
              senderId: "",
            },
          ]
        : [],
    }),
  );
  const comments: InboxComment[] = (compact.comments ?? [])
    .slice(0, COMMENT_CAP)
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      unread: row.unread,
      user: { id: "cached", name: row.name, image: null },
      product: {
        id: row.productId,
        title: row.productTitle,
        images: [],
        shop: { id: "cached", name: "", logoUrl: null },
      },
    }));
  const unreadComments = compact.unreadComments ?? 0;
  const unreadMessages = conversations.reduce(
    (sum, row) => sum + (row.unreadCount ?? 0),
    0,
  );
  const urgentCount = conversations.filter((row) => row.urgentPending).length;
  return {
    conversations,
    comments,
    unreadComments,
    unreadMessages,
    urgentCount,
    badge: unreadMessages + unreadComments,
  };
}

export function compactComments(items: CommentItem[]) {
  return items.slice(-PRODUCT_COMMENT_CAP);
}

export function compactThread(messages: ChatMessage[]) {
  return messages.slice(-THREAD_CAP);
}
