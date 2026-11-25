/**
 * Contrat essayage aligné plan VTON §7 (`POST /api/v1/tryons`).
 * Provider `client-preview` = rendu géométrique local (ShipShop actuel).
 * Provider `hosted` = futur FASHN / FastAPI (non branché ici).
 */

import type { BodyProfile } from "@/src/avatars";
import type {
    AudienceId,
    MannequinFrame, MannequinId, MannequinShot
} from "@/src/product-filters";
import {
    computeTryOnLayout,
    type GarmentPhotoType,
    type TryOnLayout,
} from "@/src/virtual-try-on";

export type TryOnProvider = "client-preview" | "hosted";

export type TryOnStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type CreateTryOnRequest = {
  avatarId: MannequinId;
  /** Optionnel tant que le garment n’est pas en catalogue serveur. */
  garmentId?: string;
  provider: TryOnProvider;
  garmentPhotoType: GarmentPhotoType;
  category: string;
  /** Image article (URL locale ou remote). */
  garmentImageUrl?: string;
  garmentTitle?: string;
};

export type TryOnSession = {
  id: string;
  status: TryOnStatus;
  provider: TryOnProvider;
  avatarId: MannequinId;
  garmentPhotoType: GarmentPhotoType;
  /** Rempli quand completed (preview client). */
  layout?: TryOnLayout;
  resultPath?: string | null;
  errorCode?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

function newId() {
  return `tryon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Stub local : remplace plus tard par `POST /api/v1/tryons`.
 * Retourne immédiatement une session `completed` avec le layout 2D.
 */
export function createClientPreviewTryOn(input: {
  request: CreateTryOnRequest;
  audience: AudienceId;
  shot: MannequinShot;
  frame: MannequinFrame;
  bodyProfile?: BodyProfile | null;
  imageRatio?: number | null;
}): TryOnSession {
  const createdAt = new Date().toISOString();
  const layout = computeTryOnLayout({
    title: input.request.garmentTitle,
    category: input.request.category,
    imageRatio: input.imageRatio,
    audience: input.audience,
    shot: input.shot,
    frame: input.frame,
    bodyProfile: input.bodyProfile,
  });

  return {
    id: newId(),
    status: "completed",
    provider: "client-preview",
    avatarId: input.request.avatarId,
    garmentPhotoType: input.request.garmentPhotoType,
    layout,
    resultPath: null,
    errorCode: null,
    createdAt,
    completedAt: createdAt,
  };
}
