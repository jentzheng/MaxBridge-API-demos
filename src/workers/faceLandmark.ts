import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const urlParams = new URLSearchParams(self.location.search);
const numFaces = parseInt(urlParams.get("numFaces") || "3");

const appRoot = new URL(import.meta.env.BASE_URL, import.meta.url);

const wasmPath = new URL("models/mediapipe/wasm/", appRoot);
const modelPath = new URL(
  "models/mediapipe/face_landmarker/float16/1/face_landmarker.task",
  appRoot,
);
const vision = await FilesetResolver.forVisionTasks(wasmPath.href, true);
const model = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: modelPath.href,
    delegate: "GPU",
  },
  numFaces: numFaces,
  runningMode: "VIDEO",
});

self.postMessage({ type: "ready" });

type IncomingMessage = MessageEvent<{
  type: "frame";
  data: ImageBitmap;
  seq: number;
}>;

self.onmessage = async (event: IncomingMessage) => {
  if (event.data.type === "frame") {
    const { faceLandmarks } = model.detectForVideo(event.data.data, event.data.seq);
    self.postMessage({ type: "result", faceLandmarks: faceLandmarks });
  }
};

self.onerror = (err) => {
  console.error("[FaceLandmarkWorker] Error:", err);
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "ready";
    }
  | {
      type: "result";
      faceLandmarks: NormalizedLandmark[][];
    }
>;
