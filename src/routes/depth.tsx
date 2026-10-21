import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import type { OutgoingMessage } from "@/workers/depth";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import workerUrl from "@/workers/depth?worker&url";

export const Route = createFileRoute("/depth")({
  component: RouteComponent,
});

function RouteComponent() {
  const searchParams = Route.useSearch();
  const { sendMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const handleCameraFrame = useCallback((video: VideoFrame, seq: number) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !worker) return;

    if (canvas.width !== video.displayWidth) canvas.width = video.displayWidth;
    if (canvas.height !== video.displayHeight) canvas.height = video.displayHeight;

    worker.postMessage({ type: "frame", data: video, seq }, [video]);
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL(workerUrl, import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    const canvas = canvasRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!canvas || !ctx) return;

    worker.onmessage = (event: OutgoingMessage) => {
      if (event.data.type === "result") {
        const { depth } = event.data.result;
        const packet = writeJitMatBuffer(
          `${searchParams.username}_depth`,
          depth.channels,
          "char",
          depth.width,
          depth.height,
          depth.data,
        );
        sendMessage(packet, false);
        // if (canvas.width !== depth.width) canvas.width = depth.width;
        // if (canvas.height !== depth.height) canvas.height = depth.height;
        const imageData = ctx.createImageData(depth.width, depth.height);
        const src = depth.data;
        const dst = imageData.data;
        const channels = depth.channels;
        for (let i = 0, j = 0; i < src.length; i += channels, j += 4) {
          const v = src[i];
          dst[j] = 255; // R
          dst[j + 1] = 255; // G
          dst[j + 2] = 255; // B
          dst[j + 3] = v;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
      }
    };

    return () => {
      worker.terminate();
    };
  }, [searchParams, sendMessage]);

  return (
    <div className="relative flex h-full w-full bg-black">
      <canvas
        ref={canvasRef}
        className="absolute z-1 w-full h-full max-h-full max-w-full object-contain "
      />
      {!window.max && <Camera onFrame={handleCameraFrame} sendMessage={sendMessage} />}
    </div>
  );
}
