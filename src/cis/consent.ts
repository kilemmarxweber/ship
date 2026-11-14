import { api } from "@/src/api";
import { kvGet, kvSet } from "@/src/offline/db";
import { useSession } from "@/src/session";
import {
  CIS_POLICY_VERSION,
  type CisConsentStatus,
} from "@/src/cis/types";

const KEY = "cis.consent";

export type LocalCisConsent = {
  status: CisConsentStatus;
  policyVersion: string;
  decidedAt: string;
};

export function getLocalCisConsent(): LocalCisConsent | null {
  const raw = kvGet(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalCisConsent;
  } catch {
    return null;
  }
}

export function setLocalCisConsent(consent: LocalCisConsent) {
  kvSet(KEY, JSON.stringify(consent));
}

export function hasAcceptedCisConsent() {
  const local = getLocalCisConsent();
  return local?.status === "accepted";
}

export async function fetchRemoteCisConsent() {
  if (!useSession.getState().token) return null;
  try {
    const data = await api<{
      consent?: {
        status: CisConsentStatus;
        policyVersion: string;
        decidedAt: string;
      } | null;
      policyVersion?: string;
    }>("/api/cis/consent");
    if (data.consent) {
      setLocalCisConsent({
        status: data.consent.status,
        policyVersion: data.consent.policyVersion,
        decidedAt: data.consent.decidedAt,
      });
    }
    return data;
  } catch {
    return null;
  }
}

export async function setCisConsent(
  status: CisConsentStatus,
  opts?: { eraseData?: boolean },
) {
  const decidedAt = new Date().toISOString();
  setLocalCisConsent({
    status,
    policyVersion: CIS_POLICY_VERSION,
    decidedAt,
  });
  if (!useSession.getState().token) {
    return { status, policyVersion: CIS_POLICY_VERSION, decidedAt };
  }
  const data = await api<{
    consent?: {
      status: CisConsentStatus;
      policyVersion: string;
      decidedAt: string;
    };
  }>("/api/cis/consent", {
    method: "POST",
    body: JSON.stringify({
      status,
      policyVersion: CIS_POLICY_VERSION,
      eraseData: opts?.eraseData,
    }),
  });
  if (data.consent) {
    setLocalCisConsent({
      status: data.consent.status,
      policyVersion: data.consent.policyVersion,
      decidedAt: data.consent.decidedAt,
    });
    return data.consent;
  }
  return { status, policyVersion: CIS_POLICY_VERSION, decidedAt };
}
