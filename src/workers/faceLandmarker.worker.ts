import { FaceLandmarker } from "@mediapipe/tasks-vision";
import "@mediapipe/tasks-vision/vision_wasm_module_internal.js";

export type WorkerRequest = { type: "detect"; width: number; height: number; pixels: ArrayBuffer };

export type WorkerResponse = {
  type: "result";
  faceLandmarks: ReturnType<FaceLandmarker["detect"]>["faceLandmarks"];
};

let detectionCanvas: OffscreenCanvas | null = null;
let detectionContext: OffscreenCanvasRenderingContext2D | null = null;

const appRoot = new URL(import.meta.env.DEV ? "../../" : "./", self.location.href);
const wasmPath = new URL("models/mediapipe/wasm/", appRoot);
const modelPath = new URL(
  "models/mediapipe/face_landmarker/float16/1/face_landmarker.task",
  appRoot,
);
const faceLandmarker = await FaceLandmarker.createFromOptions(
  {
    wasmLoaderPath: "",
    wasmBinaryPath: new URL("vision_wasm_module_internal.wasm", wasmPath).href,
  },
  {
    baseOptions: {
      modelAssetPath: modelPath.href,
      delegate: "GPU",
    },
    numFaces: 1,
    runningMode: "IMAGE",
  },
);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "dispose") {
    faceLandmarker.close();
    self.close();
    return;
  }

  if (!detectionCanvas) {
    detectionCanvas = new OffscreenCanvas(message.width, message.height);
    detectionContext = detectionCanvas.getContext("2d");
  }
  if (!detectionCanvas || !detectionContext) {
    throw new Error("Could not create a 2D context for face detection");
  }
  if (detectionCanvas.width !== message.width) detectionCanvas.width = message.width;
  if (detectionCanvas.height !== message.height) detectionCanvas.height = message.height;

  detectionContext.putImageData(
    new ImageData(new Uint8ClampedArray(message.pixels), message.width, message.height),
    0,
    0,
  );
  const { faceLandmarks } = faceLandmarker.detect(detectionCanvas);
  self.postMessage({ type: "result", faceLandmarks } satisfies WorkerResponse);
};
