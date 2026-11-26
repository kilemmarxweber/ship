import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { PRODUCT_WALL_RATIO, wallNeedsContain } from "@/src/product-wall-image";

function bindPlayer(
  player: ReturnType<typeof useVideoPlayer>,
  playing: boolean,
  muted: boolean,
  loop: boolean,
  restart: boolean,
) {
  player.loop = loop;
  player.volume = 1;
  player.audioMixingMode = "mixWithOthers";
  player.muted = muted;
  if (playing) {
    if (restart) player.replay();
    void player.play();
  } else {
    player.pause();
    player.currentTime = 0;
  }
}

export function ReelVideo({
  uri,
  playing,
  muted,
  loop = true,
  onEnded,
  poster,
}: {
  uri: string;
  playing: boolean;
  muted: boolean;
  loop?: boolean;
  onEnded?: () => void;
  /** Still image shown on top of the player until the first video frame is ready. */
  poster?: string | null;
}) {
  const wasPlaying = useRef(false);
  const [frameReady, setFrameReady] = useState(false);
  useEffect(() => {
    wasPlaying.current = false;
  }, [uri]);
  const player = useVideoPlayer(uri, (next) => {
    next.loop = loop;
    next.volume = 1;
    next.audioMixingMode = "mixWithOthers";
    next.muted = muted;
    next.bufferOptions = {
      preferredForwardBufferDuration: 2,
      minBufferForPlayback: 1,
      maxBufferBytes: 4 * 1024 * 1024,
    };
    if (playing) {
      next.replay();
      void next.play();
    }
  });

  useEffect(() => {
    const restart = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    bindPlayer(player, playing, muted, loop, restart);
  }, [loop, muted, player, playing]);

  useEventListener(player, "playToEnd", () => {
    onEnded?.();
  });

  return (
    <View style={styles.videoLayer} pointerEvents="none">
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
        allowsPictureInPicture={false}
        onFirstFrameRender={() => setFrameReady(true)}
        style={[styles.mediaPhoto, frameReady ? null : styles.hiddenUntilFrame]}
      />
    </View>
  );
}

/** Aspect ratios are expensive to resolve (network round-trip), so keep them. */
const ratioCache = new Map<string, number>();
const RATIO_CACHE_MAX = 400;

function cacheRatio(uri: string, ratio: number) {
  if (ratioCache.size >= RATIO_CACHE_MAX) {
    const oldest = ratioCache.keys().next().value;
    if (oldest !== undefined) ratioCache.delete(oldest);
  }
  ratioCache.set(uri, ratio);
}

/**
 * Affiche le produit entier sur le mur.
 * Les photos plus larges que 9:16 (studio, 4:5, paysage) passent en `contain`
 * avec fond flou — plus de coupe gauche/droite.
 */
export function ReelCover({ uri }: { uri: string }) {
  const [measured, setMeasured] = useState<{
    uri: string;
    ratio: number;
  } | null>(null);
  const ratio =
    measured?.uri === uri ? measured.ratio : (ratioCache.get(uri) ?? null);

  // Tant que le ratio est inconnu → contain (évite une coupe G/D au 1er paint).
  const letterbox =
    ratio === null || wallNeedsContain(ratio, 1, PRODUCT_WALL_RATIO);

  return (
    <View style={[styles.videoLayer, styles.wallCanvas]} pointerEvents="none">
      {letterbox ? (
        <Image
          source={{ uri }}
          style={styles.mediaPhoto}
          contentFit="cover"
          contentPosition="center"
          blurRadius={40}
          cachePolicy="memory-disk"
          recyclingKey={`${uri}-wall-bg`}
        />
      ) : null}
      <Image
        source={{ uri }}
        style={styles.mediaPhoto}
        contentFit={letterbox ? "contain" : "cover"}
        contentPosition="center"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoad={(event) => {
          const nextW = event.source.width;
          const nextH = event.source.height;
          if (nextW > 0 && nextH > 0) {
            const next = nextW / nextH;
            cacheRatio(uri, next);
            setMeasured({ uri, ratio: next });
          }
        }}
      />
    </View>
  );
}

export function ReelSoundtrack({
  uri,
  playing,
  muted,
}: {
  uri: string;
  playing: boolean;
  muted: boolean;
}) {
  const wasPlaying = useRef(false);
  useEffect(() => {
    wasPlaying.current = false;
  }, [uri]);
  const player = useVideoPlayer(uri, (next) => {
    next.loop = true;
    next.volume = 1;
    next.audioMixingMode = "mixWithOthers";
    next.muted = muted;
  });

  // Expo's video player is intentionally controlled through mutable properties.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
    const restart = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    if (playing && !muted) {
      if (restart) player.replay();
      void player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [muted, player, playing]);

  return (
    <View pointerEvents="none" style={styles.hiddenAudio}>
      <VideoView
        player={player}
        nativeControls={false}
        allowsPictureInPicture={false}
        style={styles.hiddenAudio}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  videoLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  wallCanvas: {
    backgroundColor: "#0E0E14",
  },
  hiddenUntilFrame: {
    opacity: 0,
  },
  mediaPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  hiddenAudio: { width: 1, height: 1, opacity: 0, position: "absolute" },
});
