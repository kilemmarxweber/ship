export type ShopCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  ownerUserId?: string | null;
  followedByMe?: boolean;
  followersCount?: number;
  verified?: boolean | null;
  official?: boolean | null;
};

export type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  promoPercent?: number | null;
  promoTier?: string | null;
  currency?: string;
  quantity?: number;
  soldCount?: number;
  ordersCount?: number;
  canDelete?: boolean;
  status?: string;
  category?: string;
  images: string[];
  colors: string[];
  sizes: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  viewsCount?: number;
  likedByMe: boolean;
  soundtrack?: {
    id?: string;
    title?: string;
    audioUrl: string;
    durationMs?: number;
  } | null;
  soundtrackStartMs?: number;
  shop: ShopCard;
};

export type GrowthHighlight = {
  id: string;
  title: string;
  category: string;
  imageUrl: string | null;
  images?: string[];
  soundtrack?: { audioUrl: string; durationMs?: number } | null;
  hasVideo: boolean;
  likesCount: number;
  viewsCount: number;
  creator: { name: string; image: string | null };
};

export type GrowthStory = {
  id: string;
  title: string;
  body: string | null;
  mediaUrl: string | null;
  productId: string | null;
};

export type GrowthChallenge = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  completions: number;
  done: boolean;
  coverUrl?: string | null;
  coverCandidates?: string[];
  participants?: { name: string; image: string | null }[];
  spotlight?: {
    url: string;
    kind: "image" | "video";
    posterUrl?: string | null;
  } | null;
  product?: {
    kind: "catalog" | "teaser";
    id: string | null;
    title: string;
    priceCents: number | null;
    currency: string;
    shopName: string | null;
    image: string | null;
    href: string | null;
  } | null;
  event?: {
    id: string;
    title: string;
    imageUrl?: string | null;
    currency: string;
    fxCdfPerUsd?: number;
    fxKwPerUsd?: number;
    organizerName?: string;
    organizerKind?: string;
    status?: string;
    fromPriceCents?: number | null;
  } | null;
};

export type GrowthLive = {
  id: string;
  title?: string;
  viewerPeak?: number;
  followedByMe?: boolean;
  user: { id?: string; name?: string; image?: string | null };
};

export type GrowthSurface = {
  challenges?: GrowthChallenge[];
  highlights?: GrowthHighlight[];
  stories?: GrowthStory[];
  lives?: GrowthLive[];
};

export type FeedPage = {
  products: Product[];
  nextCursor: string | null;
};

export type LiveTeaser = {
  id: string;
  status?: string;
  viewerPeak?: number;
  viewerCount?: number;
  user: { id: string };
  product: { id: string } | null;
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; image: string | null };
};
