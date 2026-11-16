import { VideoPreset, type VideoCaptureOptions } from "livekit-client";

/** Profils portrait 9:16 pour live shopping (capture + encode). */
export type LiveQualityProfileId = "economy" | "standard" | "high";

export type LiveQualityProfile = {
  id: LiveQualityProfileId;
  label: string;
  /** Largeur × hauteur portrait. */
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
  facingMode: "user";
};

/** Couches simulcast additionnelles (base = capture). Portrait 9:16. */
export const PORTRAIT_SIMULCAST_LOW = new VideoPreset(360, 640, 500_000, 24);
export const PORTRAIT_SIMULCAST_MID = new VideoPreset(540, 960, 1_200_000, 30);

export const LIVE_QUALITY_PROFILES: Record<
  LiveQualityProfileId,
  LiveQualityProfile
> = {
  economy: {
    id: "economy",
    label: "Économie",
    width: 720,
    height: 1280,
    frameRate: 24,
    maxBitrate: 1_000_000,
    facingMode: "user",
  },
  standard: {
    id: "standard",
    label: "Standard HD",
    width: 720,
    height: 1280,
    frameRate: 30,
    maxBitrate: 2_200_000,
    facingMode: "user",
  },
  high: {
    id: "high",
    label: "Haute qualité",
    width: 1080,
    height: 1920,
    frameRate: 30,
    maxBitrate: 3_500_000,
    facingMode: "user",
  },
};

/** Défaut stable Android mid-range ; le manager remonte en high si Excellent. */
export const DEFAULT_LIVE_QUALITY: LiveQualityProfileId = "standard";

export function captureOptionsForProfile(
  profileId: LiveQualityProfileId,
): VideoCaptureOptions {
  const profile = LIVE_QUALITY_PROFILES[profileId];
  return {
    facingMode: profile.facingMode,
    resolution: {
      width: profile.width,
      height: profile.height,
      frameRate: profile.frameRate,
    },
  };
}

export function encodingForProfile(profileId: LiveQualityProfileId) {
  const profile = LIVE_QUALITY_PROFILES[profileId];
  return {
    maxBitrate: profile.maxBitrate,
    maxFramerate: profile.frameRate,
    priority: "high" as const,
  };
}

export const SCREEN_SHARE_QUALITY = {
  width: 720,
  height: 1280,
  frameRate: 15,
  maxBitrate: 2_000_000,
} as const;

/** Options Room LiveKit — netteté portrait + adaptive stream densités écran. */
export function buildLiveRoomOptions(
  profileId: LiveQualityProfileId = DEFAULT_LIVE_QUALITY,
) {
  return {
    adaptiveStream: { pixelDensity: "screen" as const },
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    videoCaptureDefaults: captureOptionsForProfile(profileId),
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    publishDefaults: {
      simulcast: true,
      stopMicTrackOnMute: true,
      degradationPreference: "maintain-resolution" as const,
      videoEncoding: encodingForProfile(profileId),
      videoSimulcastLayers: [PORTRAIT_SIMULCAST_LOW, PORTRAIT_SIMULCAST_MID],
      screenShareEncoding: {
        maxBitrate: SCREEN_SHARE_QUALITY.maxBitrate,
        maxFramerate: SCREEN_SHARE_QUALITY.frameRate,
      },
      screenShareSimulcastLayers: [
        new VideoPreset(360, 640, 400_000, 10),
        new VideoPreset(540, 960, 900_000, 15),
      ],
    },
  };
}

export type LiveQualityStatsSnapshot = {
  profileId: LiveQualityProfileId;
  connectionQuality: string;
  captureWidth: number | null;
  captureHeight: number | null;
  bitrateBps: number | null;
  framesPerSecond: number | null;
  packetsLost: number | null;
  updatedAt: number;
};
