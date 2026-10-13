import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { UYVYFrame } from "@/libs/webgl";

import Camera from "@/components/Camera";
import { writeJitterMatrixArrayBuffer } from "@/libs/bufferHelper";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const searchParams = Route.useSearch();
  const { websocket } = Route.useRouteContext();
  const { sendMessage } = websocket;

  const handleCameraFrame = useCallback(
    (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => {
      const camPacket = writeJitterMatrixArrayBuffer(
        `${searchParams.username}_camera`,
        4,
        "char",
        uyvyFrame.width,
        uyvyFrame.height,
        uyvyFrame.data,
      );
      sendMessage(camPacket);
    },
    [sendMessage, searchParams.username],
  );

  return (
    <div className="relative flex h-full w-full bg-black">
      {!window.max && <Camera onFrame={handleCameraFrame} />}
    </div>
  );
}
