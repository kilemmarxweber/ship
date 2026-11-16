import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type LocalVideoTrack,
} from "livekit-client";

import {
  captureOptionsForProfile,
  encodingForProfile,
  LIVE_QUALITY_PROFILES,
  type LiveQualityProfileId,
  type LiveQualityStatsSnapshot,
} from "@/src/live-quality";

const UPGRADE_STABLE_MS = 10_000;
const STATS_INTERVAL_MS = 3_000;
const MIN_PROFILE_HOLD_MS = 4_000;

function profileRank(id: LiveQualityProfileId) {
  if (id === "economy") return 0;
  if (id === "standard") return 1;
  return 2;
}

function targetFromQuality(
  quality: ConnectionQuality,
): LiveQualityProfileId | null {
  if (quality === ConnectionQuality.Lost || quality === ConnectionQuality.Poor) {
    return "economy";
  }
  if (quality === ConnectionQuality.Good) return "standard";
  if (quality === ConnectionQuality.Excellent) return "high";
  return null;
}

async function applyCameraProfile(
  local: LocalParticipant,
  profileId: LiveQualityProfileId,
) {
  const capture = captureOptionsForProfile(profileId);
  const encoding = encodingForProfile(profileId);
  const pub = local.getTrackPublication(Track.Source.Camera);
  const track = pub?.track as LocalVideoTrack | undefined;

  if (track && typeof track.restartTrack === "function") {
    try {
      await track.restartTrack(capture);
    } catch {
      if (profileId === "high") {
        await track.restartTrack(captureOptionsForProfile("standard"));
      } else {
        throw new Error("restartTrack failed");
      }
    }
  } else {
    try {
      await local.setCameraEnabled(true, capture);
    } catch {
      if (profileId === "high") {
        await local.setCameraEnabled(
          true,
          captureOptionsForProfile("standard"),
        );
      } else {
        throw new Error("setCameraEnabled failed");
      }
    }
  }

  const media = local.getTrackPublication(Track.Source.Camera)?.track
    ?.mediaStreamTrack;
  if (media && "contentHint" in media) {
    media.contentHint = "detail";
  }

  // Best-effort: re-assert publish encoding when API exists.
  const cameraPub = local.getTrackPublication(Track.Source.Camera);
  const sender = cameraPub?.track?.sender;
  if (sender && typeof sender.getParameters === "function") {
    try {
      const params = sender.getParameters();
      if (params.encodings?.length) {
        const primary = params.encodings[params.encodings.length - 1];
        if (primary) {
          primary.maxBitrate = encoding.maxBitrate;
          primary.maxFramerate = encoding.maxFramerate;
        }
        await sender.setParameters(params);
      }
    } catch {
      /* encodeur non reconfigurable à chaud */
    }
  }
}

export type LiveQualityManager = {
  stop: () => void;
  getProfile: () => LiveQualityProfileId;
  getStats: () => LiveQualityStatsSnapshot;
  subscribe: (listener: () => void) => () => void;
};

/**
 * Ajuste la capture/encode host selon ConnectionQuality + stats.
 * Ne déconnecte jamais la room. Ne touche pas aux couches viewer (simulcast).
 */
export function startLiveQualityManager(
  room: Room,
  opts: {
    enabled: boolean;
    initialProfile?: LiveQualityProfileId;
    onProfileChange?: (id: LiveQualityProfileId) => void;
  },
): LiveQualityManager {
  let profileId: LiveQualityProfileId = opts.initialProfile ?? "standard";
  let lastChangeAt = Date.now();
  let goodSince: number | null = null;
  let applying = false;
  let stopped = false;
  const listeners = new Set<() => void>();

  let stats: LiveQualityStatsSnapshot = {
    profileId,
    connectionQuality: ConnectionQuality.Unknown,
    captureWidth: null,
    captureHeight: null,
    bitrateBps: null,
    framesPerSecond: null,
    packetsLost: null,
    updatedAt: Date.now(),
  };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setProfile = async (next: LiveQualityProfileId, reason: string) => {
    if (stopped || !opts.enabled) return;
    if (next === profileId) return;
    const now = Date.now();
    // Descente immédiate ; remontée respectueuse du hold.
    if (
      profileRank(next) > profileRank(profileId) &&
      now - lastChangeAt < MIN_PROFILE_HOLD_MS
    ) {
      return;
    }
    if (applying) return;
    applying = true;
    try {
      await applyCameraProfile(room.localParticipant, next);
      profileId = next;
      lastChangeAt = Date.now();
      stats = { ...stats, profileId, updatedAt: Date.now() };
      opts.onProfileChange?.(next);
      notify();
      if (__DEV__) {
        console.info(`[live-quality] → ${next} (${reason})`);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[live-quality] apply ${next} failed`, error);
      }
    } finally {
      applying = false;
    }
  };

  const onQuality = (
    quality: ConnectionQuality,
    participant: { isLocal: boolean },
  ) => {
    if (!participant.isLocal || stopped || !opts.enabled) return;
    stats = {
      ...stats,
      connectionQuality: quality,
      updatedAt: Date.now(),
    };
    notify();

    const target = targetFromQuality(quality);
    if (!target) {
      goodSince = null;
      return;
    }

    if (profileRank(target) < profileRank(profileId)) {
      goodSince = null;
      void setProfile(target, `quality:${quality}`);
      return;
    }

    if (profileRank(target) > profileRank(profileId)) {
      if (goodSince == null) goodSince = Date.now();
      if (Date.now() - goodSince >= UPGRADE_STABLE_MS) {
        void setProfile(target, `stable:${quality}`);
        goodSince = null;
      }
      return;
    }

    goodSince = quality === ConnectionQuality.Excellent ? goodSince : null;
  };

  const pullStats = async () => {
    if (stopped || !opts.enabled) return;
    try {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track as LocalVideoTrack | undefined;
      const mediaSettings = track?.mediaStreamTrack?.getSettings?.();
      let captureWidth =
        typeof mediaSettings?.width === "number" ? mediaSettings.width : null;
      let captureHeight =
        typeof mediaSettings?.height === "number" ? mediaSettings.height : null;
      let bitrateBps: number | null = null;
      let framesPerSecond: number | null = null;
      let packetsLost: number | null = null;

      if (typeof track?.getSenderStats === "function") {
        const rows = await track.getSenderStats();
        if (Array.isArray(rows) && rows.length) {
          let bestBitrate = 0;
          let bestFps = 0;
          let lost = 0;
          for (const row of rows) {
            if (typeof row.targetBitrate === "number") {
              bestBitrate = Math.max(bestBitrate, row.targetBitrate);
            }
            if (typeof row.framesPerSecond === "number") {
              bestFps = Math.max(bestFps, row.framesPerSecond);
            }
            if (typeof row.packetsLost === "number") lost += row.packetsLost;
            if (typeof row.frameWidth === "number" && row.frameWidth > 0) {
              captureWidth = Math.max(captureWidth ?? 0, row.frameWidth);
            }
            if (typeof row.frameHeight === "number" && row.frameHeight > 0) {
              captureHeight = Math.max(captureHeight ?? 0, row.frameHeight);
            }
          }
          bitrateBps = bestBitrate || null;
          framesPerSecond = bestFps || null;
          packetsLost = lost;
        }
      }

      stats = {
        ...stats,
        profileId,
        captureWidth,
        captureHeight,
        bitrateBps,
        framesPerSecond,
        packetsLost,
        updatedAt: Date.now(),
      };
      notify();

      // FPS très bas → descendre d’un cran (thermique / encodeur).
      if (
        framesPerSecond != null &&
        framesPerSecond > 0 &&
        framesPerSecond < 18 &&
        profileId !== "economy"
      ) {
        const next: LiveQualityProfileId =
          profileId === "high" ? "standard" : "economy";
        void setProfile(next, `fps:${framesPerSecond.toFixed(1)}`);
      }
    } catch {
      /* stats optionnelles */
    }
  };

  room.on(RoomEvent.ConnectionQualityChanged, onQuality);
  const timer = setInterval(() => {
    void pullStats();
  }, STATS_INTERVAL_MS);
  void pullStats();

  return {
    stop: () => {
      stopped = true;
      room.off(RoomEvent.ConnectionQualityChanged, onQuality);
      clearInterval(timer);
      listeners.clear();
    },
    getProfile: () => profileId,
    getStats: () => stats,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function formatLiveQualityStats(snapshot: LiveQualityStatsSnapshot) {
  const profile = LIVE_QUALITY_PROFILES[snapshot.profileId];
  const res =
    snapshot.captureWidth && snapshot.captureHeight
      ? `${snapshot.captureWidth}×${snapshot.captureHeight}`
      : `${profile.width}×${profile.height}`;
  const kbps =
    snapshot.bitrateBps != null
      ? `${Math.round(snapshot.bitrateBps / 1000)} kb/s`
      : "—";
  const fps =
    snapshot.framesPerSecond != null
      ? `${snapshot.framesPerSecond.toFixed(0)} fps`
      : "—";
  return `${profile.label} · ${res} · ${fps} · ${kbps} · ${snapshot.connectionQuality}`;
}
