import {
  DrawingUtils,
  FilesetResolver,
  ObjectDetector,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useCallback, useEffect } from "react";
import { z } from "zod";

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
  loaderDeps: ({ search }) => {
    return {
      maxResults: search.maxResults,
      scoreThreshold: search.scoreThreshold,
    };
  },
  loader: async (ctx) => {
    const appRoot = new URL(import.meta.env.DEV ? "../../" : "./", self.location.href);
    const wasmPath = new URL("models/mediapipe/wasm/", appRoot);
    const modelPath = new URL(
      "models/mediapipe/object_detector/efficientdet_lite0.tflite",
      appRoot,
    );
    const vision = await FilesetResolver.forVisionTasks(wasmPath.href);

    const model = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath.href,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      maxResults: ctx.deps.maxResults,
      scoreThreshold: ctx.deps.scoreThreshold,
    });

    return {
      model,
    };
  },
});

function RouteComponent() {
  const { model } = Route.useLoaderData();
  const { username } = Route.useSearch();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const {
    websocket: { sendMessage, getWebSocket },
  } = Route.useRouteContext();

  const ws = getWebSocket() as WebSocket;

  const detect = useCallback(
    (source: TexImageSource, timestamp: number) => {
      const result = model.detectForVideo(source, timestamp);
      return result;
    },
    [model],
  );

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
      const ctx = canvas?.getContext("2d");
      const drawingUtils = drawingUtilsRef.current;
      if (!ctx || !canvas || !drawingUtils) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const camPacket = writeJitterMatrixArrayBuffer(
        `${username}_camera`,
        4,
        "char",
        uyvyFrame.width,
        uyvyFrame.height,
        uyvyFrame.data,
      );

      if (ws.bufferedAmount < 1024 * 1024) {
        sendMessage(camPacket, false);
      }

      const result = detect(video, seq);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawDetections(result, drawingUtils);

      if (result.detections.length === 0) return;

      const numOfDetection = result.detections.length;
      const data = detectorResultToFloat32Array(result);

      const message = writeJitterMatrixArrayBuffer(
        `${username}_bbox`,
        4,
        "float32",
        1,
        numOfDetection,
        data,
      );

      // console.log("ws.bufferedAmount", ws.bufferedAmount);
      if (ws.bufferedAmount < 1024 * 1024) {
        sendMessage(message, false);
      }
    },
    [detect, drawDetections, username, sendMessage, ws],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    drawingUtilsRef.current = new DrawingUtils(ctx);

    return () => {
      drawingUtilsRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex h-full w-full bg-black">
      <canvas
        ref={canvasRef}
        className="absolute z-10 w-full h-full max-h-full max-w-full object-contain "
      />
      {!window.max && <Camera onFrame={handleCameraFrame} />}
    </div>
  );
}
