export const LIVE_LOOKS = [
  { id: "naturel", label: "Naturel" },
  { id: "studio", label: "Studio" },
  { id: "doux", label: "Doux" },
  { id: "vivid", label: "Vivid" },
  { id: "cinema", label: "Cinéma" },
  { id: "noir", label: "Noir" },
] as const;

export type LiveLookId = (typeof LIVE_LOOKS)[number]["id"];

export function isLiveLookId(value: string): value is LiveLookId {
  return LIVE_LOOKS.some((look) => look.id === value);
}
