import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PREFIX = "shipshop.pay.idem.";

/** Android Keystore / expo-secure-store: letters, digits, `.` `-` `_` only. */
function slotKey(intent: string) {
  const safe = `${PREFIX}${intent}`.replace(/[^A-Za-z0-9._-]/g, "-");
  return safe.slice(0, 100);
}

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

async function readSlot(slot: string) {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(slot) ?? null;
  }
  try {
    return await SecureStore.getItemAsync(slot);
  } catch {
    return null;
  }
}

async function writeSlot(slot: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value) globalThis.localStorage?.setItem(slot, value);
    else globalThis.localStorage?.removeItem(slot);
    return;
  }
  try {
    if (value) await SecureStore.setItemAsync(slot, value);
    else await SecureStore.deleteItemAsync(slot);
  } catch {
    /* slot invalide ou store indisponible — le paiement continue */
  }
}

export async function paymentIdempotencyKey(intent: string) {
  const slot = slotKey(intent);
  const existing = await readSlot(slot);
  if (existing) return existing;
  const next = newKey();
  await writeSlot(slot, next);
  return next;
}

export async function clearPaymentIdempotencyKey(intent: string) {
  await writeSlot(slotKey(intent), null);
}
