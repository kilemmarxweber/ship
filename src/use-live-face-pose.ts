import { useEffect, useState } from "react";

import {
    FacePoseSmoother,
    idleStudioPose,
    poseFromMediaPipeLandmarks,
    type FaceLandmarkPoint,
    type FacePose,
} from "@/src/live-face-tracking";

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
