import { useCallback, useEffect, useRef, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";

import { ReelCover, ReelVideo } from "@/components/feed/ReelVideo";
import { isVideoUrl } from "@/src/api";
import { colors } from "@/src/theme";

const AUTO_MS = 3200;
const IDLE_MS = 4500;

function SlideMedia({
  uri,
  poster,
  active,
  playing,
  muted,
  loop,
  onEnded,
}: {
  uri: string;
  poster?: string | null;
  active: boolean;
  playing: boolean;
  muted: boolean;
  loop?: boolean;
  onEnded?: () => void;
}) {
  if (!isVideoUrl(uri)) {
    return <ReelCover uri={uri} />;
  }
  // Poster stays mounted under the video so play/pause never flashes black.
  return (
    <View style={styles.placeholder}>
      {poster && !isVideoUrl(poster) ? <ReelCover uri={poster} /> : null}
      {active && playing ? (
        <ReelVideo
          uri={uri}
          poster={poster}
          playing
          muted={muted}
          loop={loop}
          onEnded={onEnded}
        />
      ) : null}
    </View>
  );
}

export function ReelGallery(props: ReelGalleryProps) {
  // Remount only when the product / slide set changes — never on active on/off.
  return (
    <ReelGalleryContent
      key={`${props.restartToken}:${props.urls.join("|")}`}
      {...props}
    />
  );
}

type ReelGalleryProps = {
  urls: string[];
  playing: boolean;
  muted: boolean;
  width: number;
  height: number;
  onTap: () => void;
  dotsBottom: number;
  restartToken: string | number;
  poster?: string | null;
};

function ReelGalleryContent({
  urls,
  playing,
  muted,
  width,
  height,
  onTap,
  dotsBottom,
  poster,
}: ReelGalleryProps) {
  const scrollRef = useRef<{
    scrollTo: (opts: { x: number; y?: number; animated?: boolean }) => void;
  } | null>(null);
  const indexRef = useRef(0);
  const dragging = useRef(false);
  const resumeAt = useRef(0);
  const [index, setIndex] = useState(0);

  const canCarousel = urls.length > 1;
  const currentIsVideo = canCarousel && isVideoUrl(urls[index] ?? "");

  const goNext = useCallback(() => {
    if (!canCarousel) return;
    const next = (indexRef.current + 1) % urls.length;
    indexRef.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }, [canCarousel, urls.length, width]);

  useEffect(() => {
    if (!playing || !canCarousel || currentIsVideo) return;
    const tick = setInterval(() => {
      if (dragging.current || Date.now() < resumeAt.current) return;
      if (isVideoUrl(urls[indexRef.current] ?? "")) return;
      goNext();
    }, AUTO_MS);
    return () => clearInterval(tick);
  }, [canCarousel, currentIsVideo, goNext, playing, urls]);

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    dragging.current = false;
    resumeAt.current = Date.now() + IDLE_MS;
    const next = Math.round(
      event.nativeEvent.contentOffset.x / Math.max(width, 1),
    );
    const clamped = Math.max(0, Math.min(urls.length - 1, next));
    indexRef.current = clamped;
    setIndex(clamped);
  }

  if (urls.length === 0) {
    return <View style={[styles.frame, { width, height }]} />;
  }

  if (!canCarousel) {
    const only = urls[0];
    return (
      <Pressable style={[styles.frame, { width, height }]} onPress={onTap}>
        <SlideMedia
          uri={only}
          poster={poster}
          active
          playing={playing}
          muted={muted}
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.frame, { width, height }]}>
      <ScrollView
        ref={scrollRef as never}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        scrollEnabled={!currentIsVideo || !playing}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          dragging.current = true;
          resumeAt.current = Date.now() + IDLE_MS;
        }}
        onScrollEndDrag={onMomentumEnd}
        onMomentumScrollEnd={onMomentumEnd}
        keyboardShouldPersistTaps="handled"
      >
        {urls.map((uri, slide) => (
          <Pressable
            key={`${uri}-${slide}`}
            style={{ width, height }}
            onPress={onTap}
          >
            <SlideMedia
              uri={uri}
              poster={poster}
              active={index === slide}
              playing={playing}
              muted={muted}
              loop={false}
              onEnded={playing && index === slide ? goNext : undefined}
            />
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.dots, { bottom: dotsBottom }]} pointerEvents="none">
        {urls.map((_, slide) => (
          <View
            key={slide}
            style={[styles.dot, slide === index && styles.dotOn]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 64,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotOn: {
    width: 16,
    backgroundColor: colors.emerald,
  },
});
