import { usePrefs } from "@/src/prefs";
import { palettes } from "@/src/theme";

export function useColors() {
  return palettes[usePrefs((state) => state.theme)];
}
