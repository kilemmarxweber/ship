import { Platform } from "react-native";

import { getAttestationHeader } from "@/src/security/device-integrity";
import { getOrCreateInstallId } from "@/src/security/secure-session";

let cachedInstallId: string | null = null;

async function installId() {
  if (cachedInstallId) return cachedInstallId;
  cachedInstallId = await getOrCreateInstallId();
  return cachedInstallId;
}

/** Headers anti-abus complémentaires (le serveur décide toujours). */
export async function securityHeaders(): Promise<Record<string, string>> {
  const id = await installId();
  const attestation = await getAttestationHeader();
  return {
    "X-ShipShop-Client": Platform.OS === "web" ? "web" : "mobile",
    "X-ShipShop-Install-Id": id,
    ...attestation,
  };
}

export function retryAfterMs(response: Response, fallbackMs = 5_000) {
  const raw = response.headers.get("Retry-After");
  if (!raw) return fallbackMs;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec > 0) return Math.min(120_000, sec * 1000);
  return fallbackMs;
}

export function isRateLimitedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 429
  );
}
