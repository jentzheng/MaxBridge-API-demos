import { DrawingUtils, type ObjectDetectorResult } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useCallback, useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { OutgoingMessage } from "@/workers/objectDetect";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import workerUrl from "@/workers/objectDetect?worker&url";

const searchParam = z.object({
  maxResults: z.number().min(1).max(100).default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.5),
});

export const Route = createFileRoute("/objectDetect")({
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

  const drawDetections = useCallback((result: ObjectDetectorResult, drawingUtils: DrawingUtils) => {
    if (result.detections) {
      for (const detection of result.detections) {
        if (detection.boundingBox) {
          drawingUtils.drawBoundingBox(detection.boundingBox, {
            color: "#00ff00",
            lineWidth: 1,
            fillColor: "transparent",
          });
        }
      }
    }
  }, []);

  const handleCameraFrame = useCallback((video: VideoFrame, seq: number) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !worker) return;
    if (canvas.width !== video.displayWidth) canvas.width = video.displayWidth;
    if (canvas.height !== video.displayHeight) canvas.height = video.displayHeight;
    worker.postMessage({ type: "frame", data: video, seq }, [video]);
  }, []);

  useEffect(() => {
    const workerUrlWithParams = new URL(workerUrl, import.meta.url);
    workerUrlWithParams.searchParams.set("scoreThreshold", searchParams.scoreThreshold.toString());
    workerUrlWithParams.searchParams.set("maxResults", searchParams.maxResults.toString());
    const worker = new Worker(workerUrlWithParams, {
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
          console.log("[from worker]:Worker is ready");
          break;
        }
        case "result": {
          const { result } = event.data;
          const numOfDetection = result.detections.length;

          const data = Float32Array.from(
            event.data.result.detections.flatMap((detection) => {
              if (!detection.boundingBox) return [0, 0, 0, 0, 0];

              const score = detection.categories[0].score;

              const { originX, originY, width, height } = detection.boundingBox;
              const xmin = originX / canvas.width;
              const ymin = originY / canvas.height;
              const xmax = (originX + width) / canvas.width;
              const ymax = (originY + height) / canvas.height;
              return [xmin, ymin, xmax - xmin, ymax - ymin, score];
            }),
          );
          sendMessage(
            writeJitMatBuffer(
              `${searchParams.username}_bbox-xywh`,
              5,
              "float32",
              numOfDetection,
              1,
              data,
            ),
            false,
          );

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (numOfDetection === 0) {
            return;
          }
          drawDetections(result, drawingUtils);
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
  }, [
    drawDetections,
    searchParams.username,
    sendMessage,
    searchParams.wsaddress,
    searchParams.maxResults,
    searchParams.scoreThreshold,
  ]);

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
