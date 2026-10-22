import { DrawingUtils } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { OutgoingMessage } from "@/workers/hands";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import Worker from "@/workers/hands?worker";

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
  const isModelReady = useRef(false);

  useEffect(() => {
    const worker = new Worker();
    workerRef.current = worker;
    worker.postMessage({ type: "INIT", numHands: searchParams.numHands });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const drawingUtils = new DrawingUtils(ctx);

    worker.onmessage = ({ data }: OutgoingMessage) => {
      switch (data.type) {
        case "READY": {
          isModelReady.current = true;
          break;
        }
        case "RESULT": {
          const numHands = data.handLandmarks.length;
          const numMarks = data.handLandmarks[0]?.length || 0;
          const planecount = 3;
          const packet = writeJitMatBuffer(
            `${searchParams.username}_handlandmarks`,
            planecount,
            "float32",
            numMarks,
            numHands,
            Float32Array.from(
              data.handLandmarks.flatMap((landmarks) =>
                landmarks.flatMap(({ x, y, z }) => [x, y, z]),
              ),
            ),
          );
          sendMessage(packet, false);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (data.handLandmarks.length === 0) return;
          data.handLandmarks.forEach((landmarks) => {
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

  const handleCameraFrame = useCallback((frame: VideoFrame, seq: number) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !worker) return;
    if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
    if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
    if (!isModelReady.current) {
      frame.close();
      return;
    }

    worker.postMessage({ type: "FRAME", frame, seq }, [frame]);
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
