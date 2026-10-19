import { DrawingUtils, FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { z } from "zod";

import type { UYVYFrame } from "@/libs/webgl";
import type { OutgoingMessage } from "@/workers/faceLandmark";

import Camera from "@/components/Camera";
import { writeJitMatBuffer } from "@/libs/bufferHelper";
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
  const { sendMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

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
      switch (event.data.type) {
        case "ready": {
          console.log("Worker is ready");
          break;
        }
        case "result": {
          const numFaces = event.data.faceLandmarks.length;
          const numMarks = event.data.faceLandmarks[0]?.length || 0;
          const planecount = 3;
          const packet = writeJitMatBuffer(
            `${searchParams.username}_facelandmarks`,
            planecount,
            "float32",
            numMarks,
            numFaces,
            Float32Array.from(
              event.data.faceLandmarks.flatMap((landmarks) =>
                landmarks.flatMap(({ x, y, z }) => [x, y, z]),
              ),
            ),
          );
          sendMessage(packet, false);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (numFaces === 0) {
            return;
          }
          drawLandmarks(event.data.faceLandmarks, drawingUtils);
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

      const camPacket = writeJitMatBuffer(
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
