import { requireOptionalNativeModule } from "expo-modules-core";
import { AppState, type AppStateStatus } from "react-native";

type NativeUpdates = {
  isEnabled?: boolean;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean }>;
  fetchUpdateAsync?: () => Promise<{ isNew?: boolean }>;
  reload?: (options: null) => Promise<void>;
};

function nativeUpdates() {
  if (__DEV__) return null;
  return requireOptionalNativeModule<NativeUpdates>("ExpoUpdates");
}

export async function applyStoreUpdateIfReady() {
  const updates = nativeUpdates();
  if (!updates?.isEnabled) return;
  try {
    const check = await updates.checkForUpdateAsync?.();
    if (!check?.isAvailable) return;
    const fetched = await updates.fetchUpdateAsync?.();
    if (fetched?.isNew) await updates.reload?.(null);
  } catch {
    // Preview / store : pas d’OTA si le binaire n’embarque pas le module.
  }
}

export function watchStoreUpdates() {
  if (!nativeUpdates()?.isEnabled) return () => {};
  void applyStoreUpdateIfReady();
  const onChange = (state: AppStateStatus) => {
    if (state === "active") void applyStoreUpdateIfReady();
  };
  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}
