export const WEEKDAY_UI = [1, 2, 3, 4, 5, 6, 0] as const;
export type WeekdayJs = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABEL: Record<WeekdayJs, string> = {
  0: "Dim",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
};

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseWorkDays(raw: unknown): WeekdayJs[] {
  if (!Array.isArray(raw)) return [];
  const days = new Set<WeekdayJs>();
  for (const n of raw) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6) {
      days.add(n as WeekdayJs);
    }
  }
  return [...days].sort((a, b) => a - b);
}

export function hoursAreConfigured(shop: {
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
  workDays?: unknown;
}) {
  if (shop.alwaysOpen) return true;
  const days = parseWorkDays(shop.workDays);
  return (
    days.length > 0 &&
    TIME_HHMM.test(shop.hoursStart ?? "") &&
    TIME_HHMM.test(shop.hoursEnd ?? "")
  );
}
