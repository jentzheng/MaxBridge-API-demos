import { DrawingUtils, type ObjectDetectorResult } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useCallback, useEffect } from "react";
import { z } from "zod";

import type { OutgoingMessage } from "@/workers/objectDetect";

import workerUrl from "@/workers/objectDetect?worker&url";

import type { UYVYFrame } from "../libs/webgl";

import Camera from "../components/Camera";
import { writeJitterMatrixArrayBuffer } from "../libs/bufferHelper";

const searchParam = z.object({
  maxResults: z.number().min(1).max(100).default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.5),
});

export const Route = createFileRoute("/objectDetect")({
  component: RouteComponent,
  validateSearch: searchParam,
});

function RouteComponent() {
  const { username, maxResults, scoreThreshold } = Route.useSearch();
  const {
    websocket: { sendMessage, getWebSocket },
  } = Route.useRouteContext();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const ws = getWebSocket();

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

  const detectorResultToFloat32Array = (result: ObjectDetectorResult) => {
    const numOfDetection = result.detections.length;
    const planecount = 4; //xywh
    const data = new Float32Array(numOfDetection * planecount);
    result.detections.forEach((detection, boxIdx) => {
      const offset = boxIdx * planecount;
      if (detection.boundingBox) {
        const { originX, originY, width, height } = detection.boundingBox;
        data[offset] = originX;
        data[offset + 1] = originY;
        data[offset + 2] = width;
        data[offset + 3] = height;
      }
    });

    return data;
  };

  const handleCameraFrame = useCallback(
    (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => {
      const canvas = canvasRef.current;
      const worker = workerRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas || !worker) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      createImageBitmap(video).then((imageBitmap) => {
        worker.postMessage({ type: "frame", data: imageBitmap, seq }, [imageBitmap]);
        imageBitmap.close();
      });

      sendMessage(
        writeJitterMatrixArrayBuffer(
          `${username}_camera`,
          4,
          "char",
          uyvyFrame.width,
          uyvyFrame.height,
          uyvyFrame.data,
        ),
        false,
      );
    },
    [username, sendMessage],
  );

  useEffect(() => {
    const workerUrlWithParams = new URL(workerUrl, import.meta.url);
    workerUrlWithParams.searchParams.set("scoreThreshold", scoreThreshold.toString());
    workerUrlWithParams.searchParams.set("maxResults", maxResults.toString());

    const worker = new Worker(workerUrlWithParams, {
      type: "module",
    });
    workerRef.current = worker;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const drawingUtils = new DrawingUtils(ctx);

    worker.onmessage = (event: OutgoingMessage) => {
      if (event.data.type === "ready") {
        console.log("[from worker]:Worker is ready");
      } else if (event.data.type === "result") {
        const { result } = event.data;
        const numOfDetection = result.detections.length;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDetections(result, drawingUtils);
        if (numOfDetection === 0) return;
        const data = detectorResultToFloat32Array(result);

        sendMessage(
          writeJitterMatrixArrayBuffer(`${username}_bbox`, 4, "float32", 1, numOfDetection, data),
          false,
        );
      }
    };

    return () => {
      worker.terminate();
    };
  }, [drawDetections, username, sendMessage, ws, maxResults, scoreThreshold]);

  return (
    <div className="relative flex h-full w-full bg-black">
      <canvas
        ref={canvasRef}
        className="absolute z-1 w-full h-full max-h-full max-w-full object-contain "
      />
      {!window.max && <Camera onFrame={handleCameraFrame} />}
    </div>
  );
}
