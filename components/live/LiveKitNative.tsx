import { Ionicons } from "@expo/vector-icons";
import {
    AndroidAudioTypePresets,
    AudioDeviceModule,
    AudioEngineMuteMode,
    AudioSession,
    isTrackReference,
    registerGlobals,
    RoomContext,
    useConnectionState,
    useDataChannel,
    useLocalParticipant,
    useRoomContext,
    useTracks,
    VideoTrack,
} from "@livekit/react-native";
import {
    ConnectionState,
    Room,
    RoomEvent,
    Track,
    type LocalParticipant,
    type ScreenShareCaptureOptions,
} from "livekit-client";
import {
    Component,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ErrorInfo,
    type ReactNode,
} from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveFilterOverlay } from "@/components/live/LiveFilterOverlay";
import {
    LiveScreenShareSheet,
    type LiveScreenShareMode,
} from "@/components/live/LiveScreenShareSheet";
import { LiveWaiting } from "@/components/live/LiveWaiting";
import { AR_FILTERS, isArFilterId } from "@/src/live-ar-filters";
import { isLiveLookId } from "@/src/live-look";
import {
    demanderMicro,
    ensureCameraPermission,
    isLiveRtcAvailable,
    requestLiveAvPermissions,
    requestNotificationPermission,
} from "@/src/live-rtc";
import { setActiveScreenShareLiveId } from "@/src/live-share-session";
import {
    normalizeStageLayout,
    type LiveStageLayoutId,
} from "@/src/live-stage-layout";
import { showToast } from "@/src/toast";

if (isLiveRtcAvailable()) {
  registerGlobals();
}

const CAMERA = {
  facingMode: "user" as const,
  // Portrait studio — netteté + fluidité pour le diffuseur / invités.
  resolution: { width: 720, height: 1280, frameRate: 30 },
};

const MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
const MIC_PUBLISH = { stopMicTrackOnMute: true };

const ROOM_OPTIONS = {
  adaptiveStream: false,
  dynacast: false,
  stopLocalTrackOnUnpublish: true,
  videoCaptureDefaults: CAMERA,
  audioCaptureDefaults: MIC_CAPTURE,
  publishDefaults: {
    simulcast: false,
    stopMicTrackOnMute: true,
    videoEncoding: { maxBitrate: 1_200_000, maxFramerate: 30 },
    screenShareEncoding: { maxBitrate: 1_800_000, maxFramerate: 15 },
  },
};

const SCREEN_SHARE_RESOLUTION = {
  // 720p @ 12 fps — plus stable Android (évite OOM / kill pendant « Tout l’écran »)
  width: 720,
  height: 1280,
  frameRate: 12,
};

function androidApiLevel() {
  if (Platform.OS !== "android") return 0;
  const raw = Platform.Version;
  return typeof raw === "number" ? raw : Number.parseInt(String(raw), 10) || 0;
}

function screenShareCaptureOptions(
  mode: LiveScreenShareMode,
): ScreenShareCaptureOptions {
  if (mode === "app") {
    return {
      audio: false,
      preferCurrentTab: true,
      contentHint: "detail",
      video: { displaySurface: "window" },
      resolution: SCREEN_SHARE_RESOLUTION,
    };
  }
  return {
    audio: false,
    contentHint: "detail",
    video: { displaySurface: "monitor" },
    resolution: SCREEN_SHARE_RESOLUTION,
  };
}

const MAX_STAGE_PIPS = 8;
const CONNECT_OPTIONS = { autoSubscribe: true };

const SPEAKER_ROUTE = ["speaker", "bluetooth", "headset", "earpiece"] as const;

async function setDeviceMicOpen(open: boolean) {
  try {
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: [...SPEAKER_ROUTE],
        audioTypeOptions: open
          ? AndroidAudioTypePresets.communication
          : AndroidAudioTypePresets.media,
      },
      ios: { defaultOutput: "speaker" },
    });
  } catch {
    /* session déjà active */
  }
  try {
    await AudioSession.setAppleAudioConfiguration(
      open
        ? {
            audioCategory: "playAndRecord",
            audioMode: "videoChat",
            audioCategoryOptions: [
              "allowBluetooth",
              "defaultToSpeaker",
              "mixWithOthers",
            ],
          }
        : {
            audioCategory: "playback",
            audioMode: "moviePlayback",
            audioCategoryOptions: ["mixWithOthers"],
          },
    );
  } catch {
    /* Android / session absente */
  }
  try {
    await AudioDeviceModule.setMuteMode(AudioEngineMuteMode.RestartEngine);
  } catch {
    /* Android */
  }
  try {
    await AudioDeviceModule.setMicrophoneMuted(!open);
  } catch {
    /* Android / non supporté */
  }
  try {
    if (open) await AudioDeviceModule.startLocalRecording();
    else {
      await AudioDeviceModule.stopLocalRecording();
      await AudioDeviceModule.stopRecording();
    }
  } catch {
    /* Android / non supporté */
  }
}

async function releaseLocalMicHardware(localParticipant: LocalParticipant) {
  const pubs = [
    localParticipant.getTrackPublication(Track.Source.Microphone),
    ...localParticipant.audioTrackPublications.values(),
  ];
  const seen = new Set<unknown>();
  for (const pub of pubs) {
    const track = pub?.track;
    if (!track || seen.has(track)) continue;
    seen.add(track);
    try {
      track.mediaStreamTrack.enabled = false;
    } catch {
      /* ignore */
    }
    try {
      await localParticipant.unpublishTrack(track, true);
    } catch {
      /* déjà dépublié */
    }
    try {
      track.stop();
    } catch {
      /* ignore */
    }
    try {
      track.mediaStreamTrack.stop();
    } catch {
      /* ignore */
    }
  }
}

let micGate: Promise<void> = Promise.resolve();

function setLiveMicrophone(localParticipant: LocalParticipant, on: boolean) {
  const run = async () => {
    if (on) {
      await setDeviceMicOpen(true);
      await localParticipant.setMicrophoneEnabled(
        true,
        MIC_CAPTURE,
        MIC_PUBLISH,
      );
      try {
        await AudioDeviceModule.setMicrophoneMuted(false);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await localParticipant.setMicrophoneEnabled(
        false,
        undefined,
        MIC_PUBLISH,
      );
    } catch {
      /* ignore */
    }
    await releaseLocalMicHardware(localParticipant);
    await setDeviceMicOpen(false);
  };
  const next = micGate.then(run, run);
  micGate = next.catch(() => undefined);
  return next;
}

function onLiveError(error: Error) {
  showToast(error.message || "Live vidéo interrompu", "error");
}

const AvCtx = createContext<{
  setMicOk: (ok: boolean) => void;
  setCamOk: (ok: boolean) => void;
}>({
  setMicOk: () => undefined,
  setCamOk: () => undefined,
});

const LookCtx = createContext<{
  look: string;
  pick: (id: string) => void;
  isHost: boolean;
}>({
  look: "studio",
  pick: () => undefined,
  isHost: false,
});

const ScreenShareCtx = createContext<{
  mode: LiveScreenShareMode | null;
  setMode: (mode: LiveScreenShareMode | null) => void;
}>({
  mode: null,
  setMode: () => undefined,
});

function useLiveRoomOrNull() {
  return useContext(RoomContext) ?? null;
}

function LiveLookProvider({
  isHost,
  children,
}: {
  isHost: boolean;
  children: ReactNode;
}) {
  const [look, setLook] = useState("studio");
  const { send, message } = useDataChannel("ss-filter");

  useEffect(() => {
    if (isHost || !message?.payload) return;
    const next = new TextDecoder().decode(message.payload);
    if (isLiveLookId(next) || isArFilterId(next)) setLook(next);
  }, [isHost, message]);

  const pick = (id: string) => {
    setLook(id);
    if (isHost) void send(new TextEncoder().encode(id), { reliable: true });
  };

  return (
    <LookCtx.Provider value={{ look, pick, isHost }}>
      {children}
    </LookCtx.Provider>
  );
}

export function LiveCatalogSync(props: {
  isHost: boolean;
  open: boolean;
  presentedProductId?: string | null;
  scrollY?: number;
  onRemote: (next: {
    open: boolean;
    presentedProductId: string | null;
    scrollY?: number;
  }) => void;
}) {
  const room = useLiveRoomOrNull();
  if (!room) return null;
  return <LiveCatalogSyncInner {...props} />;
}

function LiveCatalogSyncInner({
  isHost,
  open,
  presentedProductId,
  scrollY = 0,
  onRemote,
}: {
  isHost: boolean;
  open: boolean;
  presentedProductId?: string | null;
  scrollY?: number;
  onRemote: (next: {
    open: boolean;
    presentedProductId: string | null;
    scrollY?: number;
  }) => void;
}) {
  const { send, message } = useDataChannel("ss-catalog");
  const lastOpen = useRef("");
  const lastScroll = useRef("");
  const scrollRef = useRef(scrollY);
  scrollRef.current = scrollY;

  useEffect(() => {
    if (!isHost) return;
    const payload = JSON.stringify({
      open,
      presentedProductId: presentedProductId ?? null,
    });
    if (payload === lastOpen.current) return;
    lastOpen.current = payload;
    void send(
      new TextEncoder().encode(
        JSON.stringify({
          open,
          presentedProductId: presentedProductId ?? null,
          scrollY: scrollRef.current,
        }),
      ),
      { reliable: true },
    );
  }, [isHost, open, presentedProductId, send]);

  useEffect(() => {
    if (!isHost) return;
    const key = scrollY.toFixed(3);
    if (key === lastScroll.current) return;
    lastScroll.current = key;
    void send(
      new TextEncoder().encode(
        JSON.stringify({
          open,
          presentedProductId: presentedProductId ?? null,
          scrollY,
        }),
      ),
      { reliable: false },
    );
  }, [isHost, open, presentedProductId, scrollY, send]);

  useEffect(() => {
    if (isHost || !message?.payload) return;
    try {
      const next = JSON.parse(new TextDecoder().decode(message.payload)) as {
        open?: boolean;
        presentedProductId?: string | null;
        scrollY?: number;
      };
      onRemote({
        open: Boolean(next.open),
        presentedProductId:
          typeof next.presentedProductId === "string" && next.presentedProductId
            ? next.presentedProductId
            : null,
        ...(typeof next.scrollY === "number" && Number.isFinite(next.scrollY)
          ? { scrollY: Math.min(1, Math.max(0, next.scrollY)) }
          : {}),
      });
    } catch {
      /* ignore */
    }
  }, [isHost, message, onRemote]);

  return null;
}

export function startLiveAudioSession() {
  void AudioSession.startAudioSession();
  return () => {
    void AudioSession.stopAudioSession();
  };
}

class TrackSafe extends Component<
  { children: ReactNode; fallback: ReactNode },
  { broken: boolean }
> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.broken) return this.props.fallback;
    return this.props.children;
  }
}

function PublishLocalAv({
  enabled,
  cameraOn,
  micOn,
}: {
  enabled: boolean;
  cameraOn: boolean;
  micOn: boolean;
}) {
  const connection = useConnectionState();
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant();
  // WhatsApp-style : pendant le partage, seule l’écran est publié.
  const wantCamera = cameraOn && !isScreenShareEnabled;

  const applied = useRef({ camera: false, mic: false });
  const lastConn = useRef(connection);

  useEffect(() => {
    const becameConnected =
      lastConn.current !== ConnectionState.Connected &&
      connection === ConnectionState.Connected;
    lastConn.current = connection;
    if (!enabled) return;
    if (
      connection === ConnectionState.Reconnecting ||
      connection === ConnectionState.SignalReconnecting
    ) {
      return;
    }
    if (connection === ConnectionState.Disconnected) {
      applied.current = { camera: false, mic: false };
      return;
    }
    if (connection !== ConnectionState.Connected) return;
    if (
      !becameConnected &&
      applied.current.camera === wantCamera &&
      applied.current.mic === micOn
    ) {
      return;
    }
    applied.current = { camera: wantCamera, mic: micOn };
    let cancelled = false;
    void (async () => {
      try {
        await localParticipant.setCameraEnabled(wantCamera, CAMERA);
      } catch {
        if (!cancelled)
          showToast("Caméra indisponible sur cet appareil", "error");
      }
      try {
        await setLiveMicrophone(localParticipant, micOn);
      } catch {
        if (!cancelled) showToast("Micro indisponible", "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, enabled, localParticipant, micOn, wantCamera]);

  return null;
}

function SubscribeRemoteVideo() {
  const room = useRoomContext();
  useEffect(() => {
    const pull = () => {
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          const video =
            pub.source === Track.Source.Camera ||
            pub.source === Track.Source.ScreenShare ||
            pub.kind === Track.Kind.Video;
          const audio =
            pub.source === Track.Source.Microphone ||
            pub.source === Track.Source.ScreenShareAudio ||
            pub.kind === Track.Kind.Audio;
          if (!video && !audio) continue;
          if (!pub.isSubscribed) pub.setSubscribed(true);
        }
      }
    };
    pull();
    room.on(RoomEvent.Connected, pull);
    room.on(RoomEvent.ParticipantConnected, pull);
    room.on(RoomEvent.TrackPublished, pull);
    return () => {
      room.off(RoomEvent.Connected, pull);
      room.off(RoomEvent.ParticipantConnected, pull);
      room.off(RoomEvent.TrackPublished, pull);
    };
  }, [room]);
  return null;
}

export function LiveKitRoomGate({
  url,
  token,
  canPublish,
  isHost = canPublish,
  connect,
  paused,
  cameraOn = true,
  micOn = true,
  children,
}: {
  url: string;
  token: string;
  canPublish: boolean;
  isHost?: boolean;
  connect: boolean;
  paused?: boolean;
  cameraOn?: boolean;
  micOn?: boolean;
  children: ReactNode;
}) {
  const [audioOn, setAudioOn] = useState(false);
  const [av, setAv] = useState({
    camera: !canPublish,
    microphone: !canPublish,
  });
  const room = useRef<Room | null>(null);
  if (!room.current) room.current = new Room(ROOM_OPTIONS);
  const avApi = useMemo(
    () => ({
      setCamOk: (ok: boolean) => setAv((cur) => ({ ...cur, camera: ok })),
      setMicOk: (ok: boolean) => setAv((cur) => ({ ...cur, microphone: ok })),
    }),
    [],
  );
  const [screenShareMode, setScreenShareMode] =
    useState<LiveScreenShareMode | null>(null);
  const screenShareApi = useMemo(
    () => ({ mode: screenShareMode, setMode: setScreenShareMode }),
    [screenShareMode],
  );

  useEffect(() => {
    const instance = room.current;
    return () => {
      void instance?.disconnect();
    };
  }, []);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const permissionTask = canPublish
        ? requestLiveAvPermissions()
        : Promise.resolve({
            camera: true,
            microphone: true,
            notifications: true,
          });
      try {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: [
              "speaker",
              "bluetooth",
              "headset",
              "earpiece",
            ],
            audioTypeOptions: canPublish
              ? AndroidAudioTypePresets.communication
              : AndroidAudioTypePresets.media,
          },
          ios: { defaultOutput: "speaker" },
        });
        await AudioSession.startAudioSession();
        const access = await permissionTask;
        if (stop) return;
        if (canPublish) {
          setAv({ camera: access.camera, microphone: access.microphone });
        }
        setAudioOn(true);
      } catch {
        if (!stop) {
          showToast("Audio live indisponible", "error");
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [canPublish]);

  useEffect(() => {
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  const shouldConnect =
    connect && (audioOn || !canPublish) && !(paused && !canPublish);
  const joined = useRef({ url: "", token: "" });
  const connectGen = useRef(0);

  useEffect(() => {
    const instance = room.current;
    if (!instance) return;
    const my = ++connectGen.current;

    void (async () => {
      if (!shouldConnect) {
        if (!joined.current.url) return;
        joined.current = { url: "", token: "" };
        if (my !== connectGen.current) return;
        if (instance.state !== ConnectionState.Disconnected) {
          await instance.disconnect();
        }
        return;
      }
      const already =
        instance.state !== ConnectionState.Disconnected &&
        joined.current.url === url &&
        (joined.current.token === token || isHost);
      if (already) return;
      try {
        if (instance.state !== ConnectionState.Disconnected) {
          await instance.disconnect();
        }
        if (my !== connectGen.current) return;
        await instance.connect(url, token, CONNECT_OPTIONS);
        if (my !== connectGen.current) return;
        joined.current = { url, token };
      } catch (error) {
        if (my === connectGen.current) onLiveError(error as Error);
      }
    })();
  }, [isHost, shouldConnect, token, url]);

  return (
    <AvCtx.Provider value={avApi}>
      <ScreenShareCtx.Provider value={screenShareApi}>
        <RoomContext.Provider value={room.current}>
          <LiveLookProvider isHost={isHost}>
            <PublishLocalAv
              enabled={canPublish && audioOn}
              cameraOn={cameraOn && av.camera}
              micOn={micOn && av.microphone}
            />
            <SubscribeRemoteVideo />
            {children}
          </LiveLookProvider>
        </RoomContext.Provider>
      </ScreenShareCtx.Provider>
    </AvCtx.Provider>
  );
}

export function LiveKitVideo(props: {
  isHost: boolean;
  hostUserId?: string;
  cameraOn?: boolean;
  hostAvatar?: string | null;
  ended: boolean;
  paused: boolean;
  stageLayout?: string | null;
  onKickPlayback?: () => void;
}) {
  const room = useLiveRoomOrNull();
  if (!room) {
    return (
      <LiveWaiting
        avatar={props.hostAvatar}
        isHost={props.isHost}
        onRetry={props.onKickPlayback}
      />
    );
  }
  return <LiveKitVideoInner {...props} />;
}

function LiveKitVideoInner({
  isHost,
  hostUserId,
  cameraOn = true,
  hostAvatar,
  ended,
  paused,
  stageLayout,
  onKickPlayback,
}: {
  isHost: boolean;
  hostUserId?: string;
  cameraOn?: boolean;
  hostAvatar?: string | null;
  ended: boolean;
  paused: boolean;
  stageLayout?: string | null;
  onKickPlayback?: () => void;
}) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const cameraTracks = tracks.filter(
    (row) => isTrackReference(row) && row.source === Track.Source.Camera,
  );
  const screenTracks = tracks.filter(
    (row) => isTrackReference(row) && row.source === Track.Source.ScreenShare,
  );
  const remotes = cameraTracks.filter(
    (row) => isTrackReference(row) && !row.participant.isLocal,
  );
  const hostCamera =
    remotes.find((row) => row.participant.identity === hostUserId) ??
    remotes[0];
  const localCamera = cameraTracks.find(
    (row) => isTrackReference(row) && row.participant.isLocal,
  );
  const hostScreen =
    screenTracks.find(
      (row) =>
        isTrackReference(row) &&
        (isHost
          ? row.participant.isLocal
          : !hostUserId || row.participant.identity === hostUserId),
    ) ??
    screenTracks.find(
      (row) => isTrackReference(row) && !row.participant.isLocal,
    ) ??
    (isHost
      ? screenTracks.find(
          (row) => isTrackReference(row) && row.participant.isLocal,
        )
      : undefined);
  const sharing = isTrackReference(hostScreen);
  // Host local : placeholder (évite le miroir infini) — viewers voient l’écran.
  const shown = sharing
    ? isHost
      ? undefined
      : hostScreen
    : isHost
      ? localCamera
      : hostCamera;
  const hasVideo =
    isTrackReference(shown) && (sharing || isHost || cameraOn !== false);
  const look = useContext(LookCtx).look;

  // Invités sur scène (1…N) : cameras distants sauf le host.
  const guestRemotes = remotes.filter(
    (row) =>
      isTrackReference(row) &&
      (!hostUserId || row.participant.identity !== hostUserId),
  );
  // Invité local aussi visible en PIP (comme le rail web).
  const stageSlots = [
    ...(!isHost && isTrackReference(localCamera) ? [localCamera] : []),
    ...guestRemotes,
  ]
    .filter(isTrackReference)
    .slice(0, MAX_STAGE_PIPS);

  const layout: LiveStageLayoutId = normalizeStageLayout(stageLayout);
  const pipCount = stageSlots.length;
  const gridish = layout === "board" || layout === "split";
  const pipH = gridish ? (pipCount > 4 ? 96 : 120) : pipCount > 4 ? 104 : 148;
  const pipW = gridish ? (pipCount > 4 ? 72 : 96) : pipCount > 4 ? 76 : 108;
  const pipGap = gridish ? 6 : 8;
  const hostStageStyle =
    layout === "split" && pipCount > 0 && !sharing
      ? styles.hostStageSplit
      : styles.stageVideo;
  const guestRailStyle =
    layout === "board"
      ? styles.guestBoard
      : layout === "split"
        ? styles.guestSplit
        : styles.guestRail;

  return (
    <View style={styles.fill}>
      <View style={hostStageStyle}>
        {sharing && isHost ? (
          <View style={[styles.fill, styles.shareLocalStage]}>
            <View style={styles.shareLocalIcon}>
              <Ionicons name="phone-portrait" size={36} color="#7dffb3" />
            </View>
            <Text style={styles.shareLocalTitle}>Partage d’écran</Text>
            <Text style={styles.shareLocalBody}>
              Les spectateurs voient ton bureau Android — caméra coupée
            </Text>
          </View>
        ) : hasVideo && isTrackReference(shown) ? (
          <TrackSafe fallback={null}>
            <VideoTrack
              trackRef={shown}
              style={styles.fill}
              objectFit={sharing ? "contain" : "cover"}
              zOrder={0}
              mirror={!sharing && Boolean(isHost || shown.participant.isLocal)}
            />
          </TrackSafe>
        ) : ended || paused ? (
          <View style={[styles.fill, styles.endedStage]} />
        ) : (
          <LiveWaiting
            avatar={hostAvatar}
            isHost={isHost}
            onRetry={onKickPlayback}
          />
        )}
        {/* Filtre plein cadre = même surface que la vidéo (peau + décor) */}
        {hasVideo && !sharing ? (
          <View style={styles.filterLayer} pointerEvents="none">
            <LiveFilterOverlay look={look} />
          </View>
        ) : null}
      </View>

      {stageSlots.length > 0 ? (
        <View style={guestRailStyle} pointerEvents="box-none">
          {stageSlots.map((row, index) => {
            const pipPos =
              layout === "board"
                ? {
                    left: 12 + (index % 2) * (pipW + pipGap),
                    bottom: 132 + Math.floor(index / 2) * (pipH + pipGap),
                    width: pipW,
                    height: pipH,
                  }
                : layout === "split"
                  ? {
                      top: 88 + index * (pipH + pipGap),
                      right: 10,
                      width: pipW,
                      height: pipH,
                    }
                  : {
                      top: 88 + index * (pipH + pipGap),
                      right: 12,
                      width: pipW,
                      height: pipH,
                    };
            return (
              <View
                key={row.participant.sid || row.participant.identity}
                style={[styles.guestPip, pipPos]}
              >
                <TrackSafe fallback={null}>
                  <VideoTrack
                    trackRef={row}
                    style={styles.fill}
                    objectFit="cover"
                    zOrder={3 + index}
                    mirror={row.participant.isLocal}
                  />
                </TrackSafe>
                {hasVideo ? (
                  <LiveFilterOverlay look={look} intensity="pip" />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {!isHost && !sharing && cameraOn === false && !ended && hostCamera ? (
        <View style={styles.wait} pointerEvents="none">
          <Text style={styles.waitTitle}>Caméra du diffuseur coupée</Text>
          <Text style={styles.waitBody}>
            Le live continue — le son est actif
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Icônes looks historiques ; les AR overlays utilisent l’emoji du catalogue. */
const FILTER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  none: "close-circle-outline",
  naturel: "sunny-outline",
  studio: "sparkles-outline",
  doux: "flower-outline",
  vivid: "flash-outline",
  cinema: "film-outline",
  noir: "moon-outline",
};

export function LiveFilterBar() {
  const { look, pick, isHost } = useContext(LookCtx);
  const [open, setOpen] = useState(false);
  if (!isHost) return null;

  return (
    <View style={styles.studioWrap}>
      {open ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.studioMenuScroll}
          contentContainerStyle={styles.studioMenu}
        >
          {AR_FILTERS.map((item) => {
            const on = look === item.id;
            const icon = FILTER_ICONS[item.id];
            return (
              <Pressable
                key={item.id}
                accessibilityLabel={item.name}
                onPress={() => {
                  pick(item.id);
                  setOpen(false);
                }}
                style={[styles.filterChip, on && styles.filterChipOn]}
              >
                {icon ? (
                  <Ionicons
                    name={icon}
                    size={18}
                    color={on ? "#05140F" : "#fff"}
                  />
                ) : (
                  <Text style={styles.filterEmoji}>{item.emoji}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <Pressable
        style={[styles.avBtn, open && styles.studioBtnOn]}
        onPress={() => setOpen((value) => !value)}
        accessibilityLabel="Galerie filtres"
      >
        <Ionicons name="color-filter" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

export function LiveScreenShareHost({
  enabled,
  liveId,
}: {
  enabled: boolean;
  liveId?: string;
}) {
  const room = useLiveRoomOrNull();
  if (!enabled || !room) return null;
  return <LiveScreenShareHostInner liveId={liveId} />;
}

function LiveScreenShareHostInner({ liveId }: { liveId?: string }) {
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant();
  const { mode, setMode } = useContext(ScreenShareCtx);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isScreenShareEnabled) {
      setMode(null);
      setActiveScreenShareLiveId(null);
    }
  }, [isScreenShareEnabled, setMode]);

  const startShare = (requested: LiveScreenShareMode) => {
    void (async () => {
      if (Platform.OS !== "android") {
        showToast("Partage d’écran bientôt sur iPhone", "info");
        setOpen(false);
        return;
      }
      let nextMode = requested;
      if (requested === "app" && androidApiLevel() < 34) {
        showToast(
          "Écran actif nécessite Android 14 — Tout l’écran lancé",
          "info",
        );
        nextMode = "full";
      }
      setBusy(true);
      try {
        // Notification FGS obligatoire — sinon Android tue l’app hors ShipShop.
        await requestNotificationPermission();
        try {
          await AudioSession.startAudioSession();
        } catch {
          /* déjà active */
        }
        if (liveId) setActiveScreenShareLiveId(liveId);
        // Coupe la caméra avant le share (WhatsApp) — PublishLocalAv la garde off.
        try {
          await localParticipant.setCameraEnabled(false);
        } catch {
          /* déjà off */
        }
        await localParticipant.setScreenShareEnabled(
          true,
          screenShareCaptureOptions(nextMode),
        );
        setMode(nextMode);
        setOpen(false);
        showToast(
          nextMode === "full"
            ? "Écran partagé — caméra coupée (comme WhatsApp)"
            : "Écran actif partagé — caméra coupée",
          "info",
        );
      } catch {
        setActiveScreenShareLiveId(null);
        showToast(
          "Partage impossible — autorise la notif puis réessaie",
          "error",
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const stopShare = () => {
    void (async () => {
      setBusy(true);
      try {
        await localParticipant.setScreenShareEnabled(false);
        setMode(null);
        setActiveScreenShareLiveId(null);
        setOpen(false);
      } catch {
        showToast("Arrêt du partage impossible", "error");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <Pressable
        style={[styles.avBtn, isScreenShareEnabled && styles.studioBtnOn]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Partage d’écran"
      >
        <Ionicons
          name={
            isScreenShareEnabled ? "phone-portrait" : "phone-portrait-outline"
          }
          size={20}
          color="#fff"
        />
      </Pressable>
      <LiveScreenShareSheet
        open={open}
        sharing={isScreenShareEnabled}
        mode={mode}
        busy={busy}
        onClose={() => setOpen(false)}
        onStart={startShare}
        onStop={stopShare}
      />
    </>
  );
}

export function LiveScreenShareBanner({
  enabled,
  liveId,
}: {
  enabled: boolean;
  liveId?: string;
}) {
  const room = useLiveRoomOrNull();
  if (!enabled || !room) return null;
  return <LiveScreenShareBannerInner liveId={liveId} />;
}

function LiveScreenShareBannerInner({ liveId }: { liveId?: string }) {
  const insets = useSafeAreaInsets();
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant();
  const { mode, setMode } = useContext(ScreenShareCtx);
  if (!isScreenShareEnabled) return null;
  const full = mode !== "app";

  return (
    <View
      style={[styles.shareBanner, { paddingTop: Math.max(insets.top, 10) }]}
      pointerEvents="box-none"
      accessibilityLabel="Partage d’écran en cours"
    >
      <View style={styles.shareBannerRow}>
        <View style={styles.shareBannerPulse} />
        <View style={styles.shareBannerCopy}>
          <Text style={styles.shareBannerText} numberOfLines={1}>
            {full
              ? "Vous partagez tout l’écran"
              : "Vous partagez l’écran actif"}
          </Text>
          <Text style={styles.shareBannerHint} numberOfLines={1}>
            Notif sticky pour revenir au live
          </Text>
        </View>
        {liveId ? (
          <Pressable
            style={styles.shareBannerReturn}
            hitSlop={8}
            onPress={() => {
              showToast("Tu es déjà sur le live", "info");
            }}
            accessibilityLabel="Revenir au live"
          >
            <Text style={styles.shareBannerReturnText}>Live</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.shareBannerStop}
          hitSlop={8}
          onPress={() => {
            void (async () => {
              try {
                await localParticipant.setScreenShareEnabled(false);
                setMode(null);
                setActiveScreenShareLiveId(null);
                showToast("Partage d’écran arrêté", "info");
              } catch {
                showToast("Arrêt du partage impossible", "error");
              }
            })();
          }}
          accessibilityLabel="Arrêter le partage d’écran"
        >
          <Text style={styles.shareBannerStopText}>Arrêter</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LiveHostAvButtons(props: {
  onCamera: (enabled: boolean) => void;
  onMic: (enabled: boolean) => void;
}) {
  const room = useLiveRoomOrNull();
  if (!room) return null;
  return <LiveHostAvButtonsInner {...props} />;
}

function LiveHostAvButtonsInner({
  onCamera,
  onMic,
}: {
  onCamera: (enabled: boolean) => void;
  onMic: (enabled: boolean) => void;
}) {
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const av = useContext(AvCtx);

  return (
    <>
      <Pressable
        style={[styles.avBtn, isScreenShareEnabled && styles.avBtnOff]}
        onPress={() => {
          if (isScreenShareEnabled) {
            showToast(
              "Arrête le partage d’écran pour réactiver la caméra",
              "info",
            );
            return;
          }
          const next = !isCameraEnabled;
          void (async () => {
            if (next && !(await ensureCameraPermission())) {
              showToast("Autorise la caméra pour filmer", "info");
              return;
            }
            try {
              await localParticipant.setCameraEnabled(next, CAMERA);
              if (next) av.setCamOk(true);
              onCamera(next);
            } catch {
              showToast("Caméra indisponible sur cet appareil", "error");
            }
          })();
        }}
      >
        <Ionicons
          name={
            isScreenShareEnabled || !isCameraEnabled
              ? "videocam-off"
              : "videocam"
          }
          size={20}
          color={isScreenShareEnabled || !isCameraEnabled ? "#FBBF24" : "#fff"}
        />
      </Pressable>
      <Pressable
        style={[styles.avBtn, !isMicrophoneEnabled && styles.avBtnOff]}
        onPress={() => {
          const next = !isMicrophoneEnabled;
          void (async () => {
            if (next) {
              const ok = await demanderMicro();
              if (!ok) return;
            }
            try {
              await setLiveMicrophone(localParticipant, next);
              av.setMicOk(next);
              onMic(next);
            } catch {
              showToast("Micro indisponible", "error");
            }
          })();
        }}
      >
        <Ionicons
          name={isMicrophoneEnabled ? "mic" : "mic-off"}
          size={20}
          color={isMicrophoneEnabled ? "#fff" : "#FBBF24"}
        />
      </Pressable>
      <LiveFilterBar />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  stageVideo: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  hostStageSplit: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    right: "38%",
    overflow: "hidden",
  },
  filterLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    elevation: 2,
  },
  guestRail: {
    ...StyleSheet.absoluteFill,
    zIndex: 4,
  },
  guestSplit: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "38%",
    zIndex: 4,
  },
  guestBoard: {
    ...StyleSheet.absoluteFill,
    zIndex: 4,
  },
  guestPip: {
    position: "absolute",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
  },
  shareLocalStage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07070C",
    gap: 10,
    paddingHorizontal: 36,
  },
  shareLocalIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(0,214,143,0.14)",
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  shareLocalTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },
  shareLocalBody: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  shareBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 40,
    elevation: 40,
    backgroundColor: "#DC2626",
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.2)",
  },
  shareBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
  },
  shareBannerCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  shareBannerPulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  shareBannerText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  shareBannerHint: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
    fontSize: 11,
  },
  shareBannerReturn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  shareBannerReturnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  shareBannerStop: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  shareBannerStopText: {
    color: "#B91C1C",
    fontWeight: "800",
    fontSize: 13,
  },
  endedStage: { backgroundColor: "#050508" },
  wait: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 8,
    paddingHorizontal: 28,
  },
  waitTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  waitBody: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    textAlign: "center",
  },
  avBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avBtnOff: {
    borderColor: "rgba(251,191,36,0.55)",
    backgroundColor: "rgba(251,191,36,0.16)",
  },
  studioWrap: {
    alignItems: "center",
    overflow: "visible",
  },
  studioBtnOn: {
    borderColor: "#00D68F",
    backgroundColor: "rgba(0,214,143,0.22)",
  },
  studioMenuScroll: {
    position: "absolute",
    right: 52,
    bottom: 0,
    maxWidth: 268,
  },
  studioMenu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  filterChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipOn: {
    backgroundColor: "#00D68F",
    borderColor: "#00D68F",
  },
  filterEmoji: { fontSize: 16 },
});
