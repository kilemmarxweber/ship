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

function readOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}) {
  // Android often reports isInternetReachable=null; treat that as online when connected.
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export async function isOnline() {
  try {
    const Network = await import("expo-network");
    const state = await Network.getNetworkStateAsync();
    cachedOnline = readOnline(state);
    return cachedOnline;
  } catch {
    cachedOnline = true;
    return true;
  }
}

export async function watchNetwork(onChange: (online: boolean) => void) {
  try {
    const Network = await import("expo-network");
    const current = await Network.getNetworkStateAsync();
    cachedOnline = readOnline(current);
    onChange(cachedOnline);
    const sub = Network.addNetworkStateListener((state) => {
      const online = readOnline(state);
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
