import { DrawingUtils, type ObjectDetectorResult } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useCallback, useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { OutgoingMessage } from "@/workers/objectDetect";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
import Worker from "@/workers/objectDetect?worker";

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
  const isModelReady = useRef(false);

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

  useEffect(() => {
    const worker = new Worker();
    workerRef.current = worker;
    worker.postMessage({
      type: "INIT",
      maxResults: searchParams.maxResults,
      scoreThreshold: searchParams.scoreThreshold,
    });
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
          const { result } = data;
          const numOfDetection = result.detections.length;

          const bboxes = Float32Array.from(
            result.detections.flatMap((detection) => {
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
              bboxes,
            ),
            false,
          );

          ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  const handleCameraFrame = useCallback((frame: VideoFrame, seq: number) => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !worker) return;
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
        className="absolute z-1 w-full h-full max-h-full max-w-full object-contain "
      />
      {!window.max && <Camera onFrame={handleCameraFrame} sendMessage={sendMessage} />}
    </div>
  );
}
