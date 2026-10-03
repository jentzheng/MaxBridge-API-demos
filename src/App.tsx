import { useRef, useEffect, useCallback } from "react";
import { DrawingUtils, FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import FaceLandmarkerWorker from "./workers/faceLandmarker.worker?worker";
import "./App.css";
import type { WorkerRequest, WorkerResponse } from "./workers/faceLandmarker.worker";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    console.log("App mounted");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const drawingUtils = new DrawingUtils(ctx);
    const worker = new FaceLandmarkerWorker();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      drawLandmarks(message.faceLandmarks, drawingUtils);
    };

    worker.onerror = (event) => {
      console.error("FaceLandmarker worker crashed", event.message);
    };

    window.max?.bindJitterImage(
      (image) => {
        if (canvas.width !== image.width) canvas.width = image.width;
        if (canvas.height !== image.height) canvas.height = image.height;
        ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
        const pixels = Uint8Array.from(image.data);
        worker.postMessage(
          {
            type: "detect",
            width: image.width,
            height: image.height,
            pixels: pixels.buffer,
          } satisfies WorkerRequest,
          [pixels.buffer],
        );
      },
      { queue: 1, drop: "oldest" },
    );

    return () => {
      drawingUtils.close();
      worker.terminate();
    };
  }, [drawLandmarks]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="navbar shrink-0 bg-base-100 shadow-sm">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">jit.gl.web demos</a>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a>Link</a>
            </li>
            <li>
              <details>
                <summary>Parent</summary>
                <ul className="bg-base-100 rounded-t-none p-2">
                  <li>
                    <a>Link 1</a>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
        </div>
      </div>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <canvas ref={canvasRef} className="block w-full max-h-full max-w-full object-cover" />
      </main>
    </div>
  );
}

export default App;
