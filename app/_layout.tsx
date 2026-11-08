import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthSheet } from "@/components/auth/AuthSheet";
import { ToastHost } from "@/components/Toast";
import { api } from "@/src/api";
import { useCart } from "@/src/cart-store";
import { hydrateOffline } from "@/src/offline/hydrate";
import { watchNetwork } from "@/src/offline/network";
import { injectSnapshots } from "@/src/offline/persist";
import { startSilentSync } from "@/src/offline/sync";
import { usePrefs } from "@/src/prefs";
import { useSession } from "@/src/session";
import { paletteOf } from "@/src/theme";
import { watchStoreUpdates } from "@/src/updates";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

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

export default function RootLayout() {
  const hydrate = useSession((state) => state.hydrate);
  const token = useSession((state) => state.token);
  const refreshCart = useCart((state) => state.refresh);
  const hydratePrefs = usePrefs((state) => state.hydrate);
  const applyRemote = usePrefs((state) => state.applyRemote);
  const theme = usePrefs((state) => state.theme);
  const palette = paletteOf(theme);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    void Promise.all([hydrate(), hydratePrefs()])
      .then(() => hydrateOffline(queryClient))
      .catch(() => undefined)
      .finally(() => {
        void SplashScreen.hideAsync();
        stopSync = startSilentSync(queryClient);
      });
    return () => stopSync?.();
  }, [hydrate, hydratePrefs]);

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
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
