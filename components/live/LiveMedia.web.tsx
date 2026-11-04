import { LiveWaiting } from "@/components/live/LiveWaiting";

export function useLiveAudioSession() {}

export function LiveKitVideo({
  hostAvatar,
  isHost,
  onKickPlayback,
}: {
  isHost?: boolean;
  hostUserId?: string;
  cameraOn?: boolean;
  hostAvatar?: string | null;
  ended?: boolean;
  paused?: boolean;
  onKickPlayback?: () => void;
}) {
  return (
    <LiveWaiting avatar={hostAvatar} isHost={isHost} onRetry={onKickPlayback} />
  );
}

export function LiveFilterBar() {
  return null;
}

export function LiveHostAvButtons(_props: {
  onCamera: (enabled: boolean) => void;
  onMic: (enabled: boolean) => void;
}) {
  return null;
}

export function LiveCatalogSync(_props: {
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
  return null;
}
