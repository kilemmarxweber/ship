import { useIsFocused, type Href } from "expo-router";
import { useEffect, useRef } from "react";

import { safeBack } from "@/src/nav";
import { useSession } from "@/src/session";

/**
 * Private screens stay blank until a session exists.
 * Login opens in place so the current route (and its query) is kept.
 * Closing login without a session leaves the screen.
 * Background tabs do not trigger this.
 */
export function useRequireSession(fallback: Href = "/") {
  const focused = useIsFocused();
  const ready = useSession((state) => state.ready);
  const token = useSession((state) => state.token);
  const authOpen = useSession((state) => state.authOpen);
  const openAuth = useSession((state) => state.openAuth);
  const asked = useRef(false);

  useEffect(() => {
    if (token) asked.current = false;
    if (!focused || !ready || token) return;
    if (!asked.current) {
      asked.current = true;
      openAuth();
      return;
    }
    if (!authOpen) safeBack(fallback);
  }, [authOpen, fallback, focused, openAuth, ready, token]);

  return { ready, token, allowed: focused && ready && Boolean(token) };
}
