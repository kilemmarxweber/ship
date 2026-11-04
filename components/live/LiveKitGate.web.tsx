import type { ReactNode } from "react";

export function LiveKitGate({
  children,
}: {
  url?: string;
  token?: string;
  canPublish?: boolean;
  connect?: boolean;
  paused?: boolean;
  cameraOn?: boolean;
  micOn?: boolean;
  children: ReactNode;
}) {
  return <>{children}</>;
}
