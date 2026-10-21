import { DrawingUtils, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { UYVYFrame } from "@/libs/webgl";
import type { OutgoingMessage } from "@/workers/hands";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import workerUrl from "@/workers/hands?worker&url";

const searchParam = z.object({
  numHands: z.number().default(2),
});

export const Route = createFileRoute("/hands")({
  component: RouteComponent,
  validateSearch: searchParam,
});

function RouteComponent() {
  const searchParams = Route.useSearch();
  const { sendMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const url = new URL(workerUrl, import.meta.url);
    const worker = new Worker(url, {
      type: "module",
    });
    workerRef.current = worker;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const drawingUtils = new DrawingUtils(ctx);

    worker.onmessage = (event: OutgoingMessage) => {
      switch (event.data.type) {
        case "ready": {
          console.log("Worker is ready");
          break;
        }
        case "result": {
          const numFaces = event.data.handLandmarks.length;
          const numMarks = event.data.handLandmarks[0]?.length || 0;
          const planecount = 3;

          const packet = writeJitMatBuffer(
            `${searchParams.username}_handlandmarks`,
            planecount,
            "float32",
            numMarks,
            numFaces,
            Float32Array.from(
              event.data.handLandmarks.flatMap((landmarks) =>
                landmarks.flatMap(({ x, y, z }) => [x, y, z]),
              ),
            ),
          );
          sendMessage(packet, false);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (event.data.handLandmarks.length === 0) return;
          event.data.handLandmarks.forEach((landmarks) => {
            drawingUtils.drawLandmarks(landmarks, {
              color: "#00ff00",
              radius: 1,
            });
          });

          break;
        }
        default: {
          break;
        }
      }
    };

    return () => {
      worker.terminate();
    };
  }, [searchParams, sendMessage]);

  const handleCameraFrame = useCallback((video: VideoFrame, seq: number, uyvyFrame: UYVYFrame) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !worker) return;
    if (canvas.width !== video.displayWidth) canvas.width = video.displayWidth;
    if (canvas.height !== video.displayHeight) canvas.height = video.displayHeight;

    worker.postMessage({ type: "frame", data: video, seq }, [video]);
  }, []);

  return (
    <div className="relative flex h-full w-full bg-black">
      <canvas
        ref={canvasRef}
        className="absolute z-1 w-full h-full max-h-full max-w-full object-contain"
      />
      {!window.max && <Camera onFrame={handleCameraFrame} sendMessage={sendMessage} />}
    </div>
  );
}
