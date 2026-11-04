export type PublicTicketType = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  quota: number;
  remaining: number;
  soldCount: number;
};

export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  venue: string;
  city: string;
  currency: string;
  status: string;
  organizerKind: string;
  organizerName: string;
  startsAt: string;
  endsAt: string;
  accessNote: string | null;
  ticketTypes: PublicTicketType[];
  organizerUserId?: string;
  platformFeeMode?: string;
  platformFeeBps?: number;
  platformFeeCents?: number;
};

export type PublicTicket = {
  id: string;
  status: string;
  currency: string;
  purchaseCents: number;
  code: string;
  qrPayload: string;
  event: {
    id: string;
    title: string;
    venue: string;
    city: string;
    startsAt: string;
    organizerName: string;
    imageUrl: string | null;
    accessNote: string | null;
  };
  type: { id: string; name: string };
  refundRequest: { id: string; status: string; reason: string } | null;
};
