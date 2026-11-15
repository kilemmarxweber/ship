import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const INSTALL_KEY = "shipshop.installId";

function randomInstallId() {
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Identifiant d'installation pseudonyme (pas une empreinte hardware). */
export async function getOrCreateInstallId(): Promise<string> {
  try {
    if (Platform.OS === "web") {
      const existing = globalThis.localStorage?.getItem(INSTALL_KEY);
      if (existing) return existing;
      const created = randomInstallId();
      globalThis.localStorage?.setItem(INSTALL_KEY, created);
      return created;
    }
    const existing = await SecureStore.getItemAsync(INSTALL_KEY);
    if (existing) return existing;
    const created = randomInstallId();
    await SecureStore.setItemAsync(INSTALL_KEY, created);
    return created;
  } catch {
    return randomInstallId();
  }
}
