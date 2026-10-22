import { DrawingUtils } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { OutgoingMessage } from "@/workers/faceLandmark";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import Worker from "@/workers/faceLandmark?worker";

const searchParam = z.object({
  numFaces: z.number().default(3),
});

export const Route = createFileRoute("/faceLandmark")({
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
    worker.postMessage({ type: "INIT", numFaces: searchParams.numFaces });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const drawingUtils = new DrawingUtils(ctx);

    worker.onmessage = ({ data }: OutgoingMessage) => {
      switch (data.type) {
        case "READY": {
          console.log("Worker is ready");
          isModelReady.current = true;
          break;
        }
        case "RESULT": {
          const numFaces = data.faceLandmarks.length;
          const numMarks = data.faceLandmarks[0]?.length || 0;
          const planecount = 3;
          const packet = writeJitMatBuffer(
            `${searchParams.username}_facelandmarks`,
            planecount,
            "float32",
            numMarks,
            numFaces,
            Float32Array.from(
              data.faceLandmarks.flatMap((landmarks) =>
                landmarks.flatMap(({ x, y, z }) => [x, y, z]),
              ),
            ),
          );
          sendMessage(packet, false);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (numFaces === 0) {
            return;
          }

          data.faceLandmarks.forEach((landmarks) => {
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
      console.log("Model is not ready yet");
      frame.close();
      return;
    }

    worker.postMessage(
      {
        type: "FRAME",
        frame,
        seq,
      },
      [frame],
    );
  }, []);

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
