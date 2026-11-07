/** Dispositions multi-invités — sync shop web / Android. */

export const LIVE_STAGE_LAYOUTS = [
  {
    id: "rail",
    label: "Rail",
    hint: "Hôte plein écran · invités à droite",
  },
  {
    id: "split",
    label: "Duo",
    hint: "Hôte à gauche · grille invités à droite",
  },
  {
    id: "board",
    label: "Grille",
    hint: "Hôte + cases invités en plateau",
  },
] as const;

export type LiveStageLayoutId = (typeof LIVE_STAGE_LAYOUTS)[number]["id"];

export function isLiveStageLayoutId(v: unknown): v is LiveStageLayoutId {
  return typeof v === "string" && LIVE_STAGE_LAYOUTS.some((l) => l.id === v);
}

export function normalizeStageLayout(v: unknown): LiveStageLayoutId {
  return isLiveStageLayoutId(v) ? v : "rail";
}
