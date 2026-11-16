import { useEffect, useState, useSyncExternalStore } from "react";

import {
    FacePoseSmoother,
    idleStudioPose,
    poseFromMediaPipeLandmarks,
    type FaceLandmarkPoint,
    type FacePose,
} from "@/src/live-face-tracking";

const poseListeners = new Set<() => void>();
let sharedPose = idleStudioPose(0, 0);
let idlePump: ReturnType<typeof setInterval> | null = null;
let idleUsers = 0;
const sharedSmoother = new FacePoseSmoother();

function emitPose(next: FacePose) {
  sharedPose = next;
  for (const listener of poseListeners) listener();
}

export function getFacePose() {
  return sharedPose;
}

/** Démarre l’animation idle sans setState. Un seul timer pour tout le live. */
export function retainIdleFacePose() {
  idleUsers += 1;
  if (!idlePump) {
    idlePump = setInterval(() => {
      emitPose(sharedSmoother.push(idleStudioPose(Date.now(), 0)));
    }, 125);
  }
  return () => {
    idleUsers -= 1;
    if (idleUsers > 0) return;
    idleUsers = 0;
    if (idlePump) clearInterval(idlePump);
    idlePump = null;
  };
}

export function publishFacePose(next: FacePose) {
  emitPose(next);
}

export function useFacePose(enabled: boolean) {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!enabled) return () => undefined;
      poseListeners.add(onStoreChange);
      return () => {
        poseListeners.delete(onStoreChange);
      };
    },
    getFacePose,
    getFacePose,
  );
}

/**
 * Pose faciale pour overlays Live / Studio.
 * Sans MediaPipe natif : idle studio lissé (évite double capture caméra).
 * Brancher `ingestLandmarks` dès qu’un Face Landmarker est disponible.
 */
export function useLiveFacePose(opts?: {
  enabled?: boolean;
  /** Hz idle / rafraîchissement UI. */
  hz?: number;
  seed?: number;
}) {
  const enabled = opts?.enabled ?? true;
  const hz = opts?.hz ?? 24;
  const seed = opts?.seed ?? 0;
  const [smoother] = useState(() => new FacePoseSmoother());
  const [pose, setPose] = useState<FacePose>(() =>
    idleStudioPose(Date.now(), seed),
  );

  useEffect(() => {
    if (!enabled) return;
    const ms = Math.max(33, Math.round(1000 / hz));
    const id = setInterval(() => {
      const raw = idleStudioPose(Date.now(), seed);
      setPose(smoother.push(raw));
    }, ms);
    return () => clearInterval(id);
  }, [enabled, hz, seed, smoother]);

  function ingestLandmarks(
    landmarks: FaceLandmarkPoint[],
    timestamp = Date.now(),
  ) {
    const raw = poseFromMediaPipeLandmarks(landmarks, timestamp);
    if (!raw) return;
    setPose(smoother.push(raw));
  }

  function ingestPose(raw: FacePose) {
    setPose(smoother.push(raw));
  }

  function reset() {
    smoother.reset();
    setPose(idleStudioPose(Date.now(), seed));
  }

  return { pose, ingestLandmarks, ingestPose, reset };
}
