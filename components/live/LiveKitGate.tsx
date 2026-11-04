import { memo, type ReactNode } from "react";

import { useNativeLive } from "@/src/live-native";

function LiveKitGateInner({
  url,
  token,
  canPublish,
  isHost,
  connect,
  paused,
  cameraOn,
  micOn,
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
  const Native = useNativeLive();
  if (!Native) return <>{children}</>;
  return (
    <Native.LiveKitRoomGate
      url={url}
      token={token}
      canPublish={canPublish}
      isHost={isHost}
      connect={connect}
      paused={paused}
      cameraOn={cameraOn}
      micOn={micOn}
    >
      {children}
    </Native.LiveKitRoomGate>
  );
}

export const LiveKitGate = memo(LiveKitGateInner);
