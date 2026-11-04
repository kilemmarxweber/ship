import { useEffect, useState } from "react";

import type * as NativeLiveModule from "@/components/live/LiveKitNative";
import { isLiveRtcAvailable } from "@/src/live-rtc";

export type NativeLive = typeof NativeLiveModule;

let cached: NativeLive | null | undefined;

export function useNativeLive() {
  const [mod, setMod] = useState<NativeLive | null>(() => cached ?? null);

  useEffect(() => {
    if (cached !== undefined) return;
    if (!isLiveRtcAvailable()) {
      cached = null;
      return;
    }
    let cancelled = false;
    void import("@/components/live/LiveKitNative")
      .then((next) => {
        cached = next;
        if (!cancelled) setMod(next);
      })
      .catch(() => {
        cached = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return mod;
}
