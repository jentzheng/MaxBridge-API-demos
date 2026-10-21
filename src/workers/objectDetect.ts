import {
  ObjectDetector,
  FilesetResolver,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

const urlParams = new URLSearchParams(self.location.search);
const maxResults = parseInt(urlParams.get("maxResults") || "3");
const scoreThreshold = parseFloat(urlParams.get("scoreThreshold") || "0.5");

const useLocalModel = import.meta.env.VITE_USE_LOCAL_MODEL;

const appRoot = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${appRoot.origin}/models/mediapipe/wasm`;
const localModelUrl = `${appRoot.origin}/models/mediapipe/object_detector/efficientdet_lite0.tflite`;
const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

const vision = await FilesetResolver.forVisionTasks(
  useLocalModel ? localWasmUrl : remoteWasmUrl,
  true,
);

const model = await ObjectDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: useLocalModel ? localModelUrl : remoteModelUrl,
    delegate: "GPU",
  },
  maxResults: maxResults,
  scoreThreshold: scoreThreshold,
  runningMode: "VIDEO",
});

self.postMessage({ type: "ready" });

type IncomingMessage = MessageEvent<{
  type: "frame";
  data: VideoFrame;
  seq: number;
}>;

self.onmessage = async (event: IncomingMessage) => {
  if (event.data.type === "frame") {
    const result = model.detectForVideo(event.data.data, event.data.seq);
    event.data.data.close();
    self.postMessage({ type: "result", result: result });
  }
};

self.onerror = (err) => {
  console.error("[ObjectDetectWorker] Error:", err);
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "ready";
    }
  | {
      type: "result";
      result: ObjectDetectorResult;
    }
>;
