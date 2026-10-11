import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { z } from "zod";

import type { UYVYFrame } from "../libs/webgl";

import Camera from "../components/Camera";
import { writeJitterMatrixArrayBuffer } from "../libs/bufferHelper";

const searchParam = z.object({
  numFaces: z.number().default(3),
});

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: searchParam,

  loader: async (ctx) => {
    const searchParams = ctx.location.search as { numFaces: number };
    const appRoot = new URL(import.meta.env.DEV ? "../../" : "./", self.location.href);
    const wasmPath = new URL("models/mediapipe/wasm/", appRoot);
    const modelPath = new URL(
      "models/mediapipe/face_landmarker/float16/1/face_landmarker.task",
      appRoot,
    );
    const vision = await FilesetResolver.forVisionTasks(wasmPath.href);

    const model = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath.href,
        delegate: "GPU",
      },
      numFaces: searchParams.numFaces,
      runningMode: "VIDEO",
    });

    return {
      model,
    };
  },
});

function Home() {
  const searchParams = Route.useSearch();
  const { websocket } = Route.useRouteContext();
  const { model: landmarker } = Route.useLoaderData();
  const { sendMessage } = websocket;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);

  const drawLandmarks = useCallback(
    (faceLandmarks: NormalizedLandmark[][], drawingUtils: DrawingUtils) => {
      faceLandmarks.forEach((landmarks) => {
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
          color: "#C0C0C070",
          lineWidth: 1,
        });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
          color: "#E0E0E0",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
          color: "#E0E0E0",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
          color: "#30FF30",
        });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
          color: "#FF3030",
        });
      });
    },
    [],
  );

  const detect = useCallback(
    (source: TexImageSource, timestamp: number) => {
      const { faceLandmarks } = landmarker.detectForVideo(source, timestamp);
      return faceLandmarks;
    },
    [landmarker],
  );

  const lastMaxSequence = useRef(0);

  const landmarkTofloat32Array = (faceLandmarks: NormalizedLandmark[][]) => {
    const numFaces = faceLandmarks.length;
    const numMarks = faceLandmarks[0]?.length || 0;
    const planecount = 3;

    const data = new Float32Array(numFaces * numMarks * planecount);
    faceLandmarks.forEach((landmarks, faceIdx) => {
      landmarks.forEach(({ x, y, z }, i) => {
        const o = (faceIdx * numMarks + i) * planecount;
        data[o] = x * 2 - 1;
        data[o + 1] = -(y * 2 - 1);
        data[o + 2] = z;
      });
    });
    return { numFaces, numMarks, planecount, data };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const drawingUtils = new DrawingUtils(ctx);
    drawingUtilsRef.current = drawingUtils;

    if (window.max) {
      window.max.bindJitterImage(
        (image) => {
          lastMaxSequence.current = lastMaxSequence.current + 1;
          if (canvas.width !== image.width) canvas.width = image.width;
          if (canvas.height !== image.height) canvas.height = image.height;
          const imageData = new ImageData(image.data, image.width, image.height);
          ctx.putImageData(imageData, 0, 0);
          const faceLandmarks = detect(canvas, lastMaxSequence.current);
          drawLandmarks(faceLandmarks, drawingUtils);

          if (faceLandmarks.length === 0) {
            window.max?.outlet("clear");
            return;
          }

          const { numFaces, numMarks, planecount, data } = landmarkTofloat32Array(faceLandmarks);

          window.max?.setJitterMatrix("face_landmarkmatrix", {
            type: "float32",
            planecount,
            dim: [numMarks, numFaces],
            data,
          });
          window.max?.outlet("update");
        },
        { queue: 20, drop: "oldest" },
      );
    }

    return () => {
      drawingUtils.close();
    };
  }, [drawLandmarks, landmarker, detect]);

  const handleCameraFrame = useCallback(
    (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => {
      const faceLandmarks = detect(video, seq);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !drawingUtilsRef.current) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLandmarks(faceLandmarks, drawingUtilsRef.current);

      const camPacket = writeJitterMatrixArrayBuffer(
        `${searchParams.username}_camera`,
        4,
        "char",
        uyvyFrame.width,
        uyvyFrame.height,
        uyvyFrame.data,
      );
      sendMessage(camPacket);

      if (faceLandmarks.length === 0) {
        return;
      }

      const { numFaces, numMarks, planecount, data } = landmarkTofloat32Array(faceLandmarks);
      const facePacket = writeJitterMatrixArrayBuffer(
        `${searchParams.username}_facelandmarks`,
        planecount,
        "float32",
        numMarks,
        numFaces,
        data,
      );
      sendMessage(facePacket);
    },
    [detect, drawLandmarks, sendMessage, searchParams.username],
  );

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
