export const CIS_POLICY_VERSION = "2026-11-13";

export type CisEventType =
  | "product_view"
  | "product_like"
  | "shop_follow"
  | "search"
  | "add_to_cart"
  | "purchase"
  | "chat_share_for_cis"
  | "wanted_signal";

export type CisConsentStatus = "accepted" | "refused" | "withdrawn";

export type CisEventInput = {
  type: CisEventType;
  productId?: string | null;
  shopId?: string | null;
  category?: string | null;
  query?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: number;
};

export type CisOutboxRow = {
  id: string;
  type: string;
  body: string;
  createdAt: number;
  tries: number;
};
