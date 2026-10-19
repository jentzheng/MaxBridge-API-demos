import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import type { UYVYFrame } from "@/libs/webgl";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const searchParams = Route.useSearch();
  const { sendMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

  const handleCameraFrame = useCallback(
    (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => {
      const camPacket = writeJitMatBuffer(
        `${searchParams.username}_camera`,
        4,
        "char",
        uyvyFrame.width,
        uyvyFrame.height,
        uyvyFrame.data,
      );
      sendMessage(camPacket, false);
    },
    [sendMessage, searchParams.username],
  );

  return (
    <div className="relative flex h-full w-full bg-black">
      {!window.max && <Camera onFrame={handleCameraFrame} />}
    </div>
  );
}
