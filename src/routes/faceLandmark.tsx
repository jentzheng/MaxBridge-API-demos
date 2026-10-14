import { DrawingUtils, FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { z } from "zod";

import type { UYVYFrame } from "@/libs/webgl";
import type { OutgoingMessage } from "@/workers/faceLandmark";

import Camera from "@/components/Camera";
import { writeJitterMatrixArrayBuffer } from "@/libs/bufferHelper";
import workerUrl from "@/workers/faceLandmark?worker&url";

const searchParam = z.object({
  numFaces: z.number().default(3),
});

export const Route = createFileRoute("/faceLandmark")({
  component: Home,
  validateSearch: searchParam,
});

function Home() {
  const searchParams = Route.useSearch();
  const { websocket } = Route.useRouteContext();
  const { sendMessage } = websocket;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

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
    const url = new URL(workerUrl, import.meta.url);
    url.searchParams.set("numFaces", searchParams.numFaces.toString());
    const worker = new Worker(url, {
      type: "module",
    });
    workerRef.current = worker;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const drawingUtils = new DrawingUtils(ctx);

    worker.onmessage = (event: OutgoingMessage) => {
      if (event.data.type === "ready") {
        console.log("Worker is ready");
      } else if (event.data.type === "result") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (event.data.faceLandmarks.length > 0) {
          const { numFaces, numMarks, planecount, data } = landmarkTofloat32Array(
            event.data.faceLandmarks,
          );
          window.max?.setJitterMatrix("face_landmarkmatrix", {
            type: "float32",
            planecount,
            dim: [numMarks, numFaces],
            data,
          });

          const packet = writeJitterMatrixArrayBuffer(
            `${searchParams.username}_facelandmarks`,
            planecount,
            "float32",
            numMarks,
            numFaces,
            data,
          );
          sendMessage(packet, false);

          drawLandmarks(event.data.faceLandmarks, drawingUtils);
        } else {
          window.max?.setJitterMatrix("face_landmarkmatrix", {
            type: "float32",
            planecount: 3,
            dim: [1, 1],
            data: new Float32Array(3),
          });

          sendMessage(
            writeJitterMatrixArrayBuffer(
              `${searchParams.username}_facelandmarks`,
              3,
              "float32",
              1,
              1,
              new Float32Array(3),
            ),
            false,
          );
        }
        window.max?.outlet("update");
      }
    };

    if (window.max) {
      window.max.bindJitterImage(
        async (image) => {
          if (canvas.width !== image.width) canvas.width = image.width;
          if (canvas.height !== image.height) canvas.height = image.height;
          const imageData = new ImageData(image.data, image.width, image.height);
          worker.postMessage({ type: "frame", seq: image.timestamp, data: imageData });
        },
        { queue: 20, drop: "oldest" },
      );
    }

    return () => {
      worker.terminate();
    };
  }, [drawLandmarks, searchParams, sendMessage]);

  const handleCameraFrame = useCallback(
    (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => {
      const canvas = canvasRef.current;
      const worker = workerRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !worker) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      createImageBitmap(video).then((imageBitmap) => {
        worker.postMessage({ type: "frame", data: imageBitmap, seq }, [imageBitmap]);
        imageBitmap.close();
      });

      const camPacket = writeJitterMatrixArrayBuffer(
        `${searchParams.username}_camera`,
        4,
        "char",
        uyvyFrame.width,
        uyvyFrame.height,
        uyvyFrame.data,
      );
      sendMessage(camPacket, false);
    },
    [searchParams, sendMessage],
  );

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
