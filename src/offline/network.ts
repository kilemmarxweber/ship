import { useEffect, useState } from "react";

let cachedOnline = true;

export function lastOnline() {
  return cachedOnline;
}

export function useOnline() {
  const [online, setOnline] = useState(cachedOnline);
  useEffect(() => {
    let stop: (() => void) | undefined;
    void watchNetwork(setOnline).then((unsub) => {
      stop = unsub;
    });
    return () => stop?.();
  }, []);
  return online;
}

export async function isOnline() {
  try {
    const Network = await import("expo-network");
    const state = await Network.getNetworkStateAsync();
    const online = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    cachedOnline = online;
    return online;
  } catch {
    cachedOnline = true;
    return true;
  }
}

export async function watchNetwork(onChange: (online: boolean) => void) {
  try {
    const Network = await import("expo-network");
    const current = await Network.getNetworkStateAsync();
    cachedOnline = Boolean(
      current.isConnected && current.isInternetReachable !== false,
    );
    onChange(cachedOnline);
    const sub = Network.addNetworkStateListener((state) => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      if (online === cachedOnline) return;
      cachedOnline = online;
      onChange(online);
    });
    return () => sub.remove();
  } catch {
    cachedOnline = true;
    onChange(true);
    return () => undefined;
  }
}
