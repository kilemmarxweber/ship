import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import {
    PRODUCT_WALL_BG,
    PRODUCT_WALL_HEIGHT,
    PRODUCT_WALL_WIDTH,
} from "@/src/product-wall-image";

type Job = {
  uri: string;
  resolve: (uri: string) => void;
  reject: (error: unknown) => void;
};

const queue: Job[] = [];
let pump: (() => void) | null = null;

function flush() {
  pump?.();
}

/** Capture native 9:16 (letterbox) pour upload produit — hors web. */
export function captureProductWallLetterbox(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ uri, resolve, reject });
    flush();
  });
}

/**
 * Host invisible monté une fois à la racine.
 * Traite la file d’attente letterbox via ViewShot.
 */
export function ProductWallCaptureHost() {
  const shotRef = useRef<ViewShotRef>(null);
  const [job, setJob] = useState<Job | null>(null);
  const busy = useRef(false);

  const finish = useCallback(
    (current: Job, result: string | null, error?: unknown) => {
      if (result) current.resolve(result);
      else current.reject(error ?? new Error("Capture impossible"));
      busy.current = false;
      setJob(null);
      queueMicrotask(() => flush());
    },
    [],
  );

  useEffect(() => {
    pump = () => {
      if (busy.current) return;
      const next = queue.shift() ?? null;
      if (!next) return;
      busy.current = true;
      setJob(next);
    };
    flush();
    return () => {
      pump = null;
    };
  }, []);

  const onImageReady = useCallback(() => {
    if (!job) return;
    const current = job;
    void (async () => {
      try {
        await new Promise((r) => setTimeout(r, 32));
        const viewShot = shotRef.current;
        if (!viewShot?.capture) throw new Error("Capture indisponible");
        const uri = await viewShot.capture();
        finish(current, uri);
      } catch (error) {
        finish(current, null, error);
      }
    })();
  }, [finish, job]);

  if (!job) return null;

  return (
    <View
      pointerEvents="none"
      style={styles.host}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ViewShot
        ref={shotRef}
        style={styles.canvas}
        options={{
          format: "jpg",
          quality: 0.85,
          result: "tmpfile",
          width: PRODUCT_WALL_WIDTH,
          height: PRODUCT_WALL_HEIGHT,
        }}
      >
        <View style={styles.canvas}>
          <Image
            source={{ uri: job.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition="center"
            onLoad={onImageReady}
            onError={() => finish(job, null, new Error("Image illisible"))}
          />
        </View>
      </ViewShot>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: -PRODUCT_WALL_WIDTH * 2,
    top: 0,
    width: PRODUCT_WALL_WIDTH,
    height: PRODUCT_WALL_HEIGHT,
    opacity: 0.01,
  },
  canvas: {
    width: PRODUCT_WALL_WIDTH,
    height: PRODUCT_WALL_HEIGHT,
    backgroundColor: PRODUCT_WALL_BG,
  },
});
