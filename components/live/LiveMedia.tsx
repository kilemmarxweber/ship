import { LiveWaiting } from "@/components/live/LiveWaiting";
import { useNativeLive } from "@/src/live-native";

export function useLiveAudioSession() {}

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
  const Native = useNativeLive();
  if (!Native) {
    return (
      <LiveWaiting
        avatar={props.hostAvatar}
        isHost={props.isHost}
        onRetry={props.onKickPlayback}
      />
    );
  }
  return <Native.LiveKitVideo {...props} />;
}

export function LiveFilterBar() {
  const Native = useNativeLive();
  if (!Native) return null;
  return <Native.LiveFilterBar />;
}

export function LiveHostAvButtons(props: {
  onCamera: (enabled: boolean) => void;
  onMic: (enabled: boolean) => void;
}) {
  const Native = useNativeLive();
  if (!Native) return null;
  return <Native.LiveHostAvButtons {...props} />;
}

export function LiveScreenShareHost(props: {
  enabled: boolean;
  liveId?: string;
}) {
  const Native = useNativeLive();
  if (!Native?.LiveScreenShareHost) return null;
  return <Native.LiveScreenShareHost {...props} />;
}

export function LiveScreenShareBanner(props: {
  enabled: boolean;
  liveId?: string;
}) {
  const Native = useNativeLive();
  if (!Native?.LiveScreenShareBanner) return null;
  return <Native.LiveScreenShareBanner {...props} />;
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
  const Native = useNativeLive();
  if (!Native?.LiveCatalogSync) return null;
  return <Native.LiveCatalogSync {...props} />;
}
