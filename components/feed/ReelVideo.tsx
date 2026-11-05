import { useEventListener } from "expo";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Platform, Image as RNImage, StyleSheet, View } from "react-native";

let audioModeReady = false;

function ensureFeedAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  void setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "mixWithOthers",
    interruptionModeAndroid: "duckOthers",
  }).catch(() => {
    audioModeReady = false;
  });
}

function safePlayerCall(run: () => void) {
  try {
    run();
  } catch {
    /* player may already be released while scrolling */
  }
}

export function ReelVideo({
  uri,
  playing,
  muted,
  loop = true,
  onEnded,
}: {
  uri: string;
  playing: boolean;
  muted: boolean;
  loop?: boolean;
  onEnded?: () => void;
}) {
  const wasPlaying = useRef(false);
  useEffect(() => {
    wasPlaying.current = false;
  }, [uri]);

  const player = useVideoPlayer(uri, (next) => {
    next.loop = loop;
    next.volume = muted ? 0 : 1;
    next.muted = muted;
    next.audioMixingMode = "mixWithOthers";
    next.staysActiveInBackground = false;
  });

  useEffect(() => {
    const restart = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    safePlayerCall(() => {
      player.loop = loop;
      player.muted = muted;
      player.volume = muted ? 0 : 1;
      player.audioMixingMode = "mixWithOthers";
      if (playing) {
        // Avoid replay() — it often stalls/crashes under fast scroll on Android.
        if (restart) player.currentTime = 0;
        player.play();
      } else {
        player.pause();
      }
    });
  }, [loop, muted, player, playing]);

  useEventListener(player, "playToEnd", () => {
    onEnded?.();
  });

  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      // surfaceView is lighter; only one video mounts at a time in the gallery.
      surfaceType={Platform.OS === "android" ? "surfaceView" : undefined}
      allowsPictureInPicture={false}
      style={styles.media}
    />
  );
}

export function ReelCover({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setRatio(null);
    RNImage.getSize(
      uri,
      (nextW, nextH) => {
        if (live && nextW > 0 && nextH > 0) setRatio(nextW / nextH);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [uri]);

  const wide = ratio !== null && ratio > 1;

  return (
    <View style={styles.media} pointerEvents="none">
      {wide ? (
        <Image
          source={{ uri }}
          style={styles.mediaPhoto}
          contentFit="cover"
          contentPosition="center"
          blurRadius={36}
          recyclingKey={`${uri}-wide-bg`}
        />
      ) : null}
      <Image
        source={{ uri }}
        style={styles.mediaPhoto}
        contentFit={wide ? "contain" : "cover"}
        contentPosition={wide ? "center" : "top"}
        recyclingKey={uri}
        onLoad={(event) => {
          const nextW = event.source.width;
          const nextH = event.source.height;
          if (nextW > 0 && nextH > 0) setRatio(nextW / nextH);
        }}
      />
    </View>
  );
}

/** Soundtrack via expo-audio — much lighter / faster than a hidden VideoPlayer. */
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
    ensureFeedAudioMode();
  }, [uri]);

  const localFile = uri.startsWith("file://") || uri.startsWith("content://");
  const player = useAudioPlayer(uri, {
    updateInterval: 1000,
    // Already on disk via SQLite media_cache — skip a second download.
    downloadFirst: !localFile,
  });

  useEffect(() => {
    const restart = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    safePlayerCall(() => {
      player.loop = true;
      player.volume = 1;
      player.muted = muted;
      if (playing && !muted) {
        if (restart) {
          void player.seekTo(0).then(() => {
            safePlayerCall(() => player.play());
          });
        } else {
          player.play();
        }
      } else {
        player.pause();
      }
    });
  }, [muted, player, playing]);

  return null;
}

const styles = StyleSheet.create({
  media: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0A0A0F",
    overflow: "hidden",
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
});
