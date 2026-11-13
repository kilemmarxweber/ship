export type ShopSocialLinks = {
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

/** Payload optionnel pour création / édition boutique. */
export function shopSocialPayload(input: {
  tiktok?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
}): ShopSocialLinks {
  const trim = (value: string) => {
    const next = value.trim();
    return next.length > 0 ? next : null;
  };
  return {
    tiktokUrl: trim(input.tiktok ?? ""),
    facebookUrl: trim(input.facebook ?? ""),
    instagramUrl: trim(input.instagram ?? ""),
    xUrl: trim(input.x ?? ""),
  };
}
