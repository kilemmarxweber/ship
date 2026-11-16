import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthSheet } from "@/components/auth/AuthSheet";
import { LaunchSplash } from "@/components/LaunchSplash";
import { ToastHost } from "@/components/Toast";
import { api } from "@/src/api";
import { useCart } from "@/src/cart-store";
import { initSentry, sentryWrap } from "@/src/monitoring/sentry";
import { hydrateOffline } from "@/src/offline/hydrate";
import { watchNetwork } from "@/src/offline/network";
import { injectSnapshots } from "@/src/offline/persist";
import { startSilentSync } from "@/src/offline/sync";
import { usePrefs } from "@/src/prefs";
import { useSession } from "@/src/session";
import { paletteOf } from "@/src/theme";
import { watchStoreUpdates } from "@/src/updates";

export { ErrorBoundary } from "expo-router";

initSentry();

SplashScreen.preventAutoHideAsync();

/** Temps mini pour lire « from Klambocore » après le paint React. */
const BRAND_HOLD_MS = 900;

onlineManager.setOnline(false);
onlineManager.setEventListener((setOnline) => {
  let active = true;
  let unsubscribe: (() => void) | undefined;
  void watchNetwork((online) => {
    if (active) setOnline(online);
  }).then((stop) => {
    unsubscribe = stop;
    if (!active) stop();
  });
  return () => {
    active = false;
    unsubscribe?.();
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: "online",
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayout() {
  const hydrate = useSession((state) => state.hydrate);
  const token = useSession((state) => state.token);
  const refreshCart = useCart((state) => state.refresh);
  const hydratePrefs = usePrefs((state) => state.hydrate);
  const applyRemote = usePrefs((state) => state.applyRemote);
  const theme = usePrefs((state) => state.theme);
  const palette = paletteOf(theme);
  const [showLaunch, setShowLaunch] = useState(true);
  const bootReady = useRef(false);
  const splashPainted = useRef(false);
  const brandShownAt = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tryDismissLaunch = useCallback(() => {
    if (!bootReady.current || !splashPainted.current) return;
    const elapsed = Date.now() - brandShownAt.current;
    const wait = Math.max(0, BRAND_HOLD_MS - elapsed);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setShowLaunch(false);
    }, wait);
  }, []);

  const onLaunchPaint = useCallback(() => {
    splashPainted.current = true;
    brandShownAt.current = Date.now();
    void SplashScreen.hideAsync().catch(() => undefined);
    tryDismissLaunch();
  }, [tryDismissLaunch]);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    void Promise.all([hydrate(), hydratePrefs()])
      .then(() => hydrateOffline(queryClient))
      .catch(() => undefined)
      .finally(() => {
        bootReady.current = true;
        stopSync = startSilentSync(queryClient);
        tryDismissLaunch();
      });
    // Filet : si onPaint rate, on retire quand même le splash natif.
    const safety = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
      bootReady.current = true;
      splashPainted.current = true;
      if (!brandShownAt.current) brandShownAt.current = Date.now();
      tryDismissLaunch();
    }, 4000);
    return () => {
      stopSync?.();
      clearTimeout(safety);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [hydrate, hydratePrefs, tryDismissLaunch]);

  useEffect(() => {
    injectSnapshots(queryClient, token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void api<{ user?: { locale?: string | null; theme?: string | null } }>(
      "/api/profile",
    )
      .then((data) => {
        if (data.user) {
          void applyRemote({
            locale: data.user.locale,
            theme: data.user.theme,
          });
        }
      })
      .catch(() => undefined);
  }, [applyRemote, token]);

  useEffect(() => {
    if (__DEV__) return;
    return watchStoreUpdates();
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [token, refreshCart]);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <QueryClientProvider client={queryClient}>
        <StatusBar style={theme === "light" ? "dark" : "light"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="events/[id]" />
          <Stack.Screen name="tickets" />
          <Stack.Screen name="profile/ticket-scan" />
          <Stack.Screen name="community" />
          <Stack.Screen name="live" />
          <Stack.Screen name="kyc" />
          <Stack.Screen name="modal" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="wanted/[id]" />
          <Stack.Screen name="ai-chat" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="courier" />
          <Stack.Screen name="seller/products" />
          <Stack.Screen name="seller/reports" />
          <Stack.Screen name="shops/index" />
          <Stack.Screen name="shops/contacts" />
          <Stack.Screen name="shops/orders" />
          <Stack.Screen name="shops/delivery" />
          <Stack.Screen name="shops/kyc" />
          <Stack.Screen name="shops/messaging" />
          <Stack.Screen name="shops/admin/[page]" />
          <Stack.Screen name="creator" />
          <Stack.Screen name="legal/cgu" />
          <Stack.Screen name="legal/aide" />
          <Stack.Screen name="legal/shiprewards" />
          <Stack.Screen name="legal/confidentialite" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <AuthSheet />
        <ToastHost />
        {showLaunch ? <LaunchSplash onPaint={onLaunchPaint} /> : null}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default sentryWrap(RootLayout);
