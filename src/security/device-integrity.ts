/**
 * Attestation native (App Attest / Play Integrity) — Phase 4.
 *
 * Contexte actuel :
 * - Expo SDK 58 + SecureStore déjà en place pour le jeton session
 * - Pas de refresh token côté Better Auth (session opaque)
 * - Distribution via EAS / possibly Expo Go en dev → attestation native
 *   non disponible partout
 *
 * Politique : signal de confiance optionnel, jamais une frontière seule.
 * Le backend ignore l'absence d'attestation (repli défini).
 */

export type DeviceIntegrityStatus = "unsupported" | "deferred" | "ready";

export function deviceIntegrityStatus(): DeviceIntegrityStatus {
  // Branches natives à brancher quand les modules EAS + clés Apple/Google sont prêts.
  return "deferred";
}

export async function getAttestationHeader(): Promise<Record<string, string>> {
  // Placeholder volontaire : ne jamais envoyer de faux jeton d'attestation.
  return {};
}
