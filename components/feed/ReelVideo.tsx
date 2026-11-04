import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Image as RNImage, StyleSheet, View } from "react-native";

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
    next.volume = 1;
    next.audioMixingMode = "mixWithOthers";
    next.muted = muted;
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
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      surfaceType="textureView"
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

  useEffect(() => {
    player.loop = true;
    player.volume = 1;
    player.audioMixingMode = "mixWithOthers";
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
  hiddenAudio: { width: 1, height: 1, opacity: 0, position: "absolute" },
});
