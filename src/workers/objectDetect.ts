import {
  ObjectDetector,
  FilesetResolver,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

const urlParams = new URLSearchParams(self.location.search);

const maxResults = parseInt(urlParams.get("maxResults") || "3");
const scoreThreshold = parseFloat(urlParams.get("scoreThreshold") || "0.5");

const appRoot = new URL(import.meta.env.BASE_URL, import.meta.url);
const wasmUrl = `${appRoot.href}/models/mediapipe/wasm/`;
const modelUrl = `${appRoot.href}/models/mediapipe/object_detector/efficientdet_lite0.tflite`;
const vision = await FilesetResolver.forVisionTasks(wasmUrl, true);
const model = await ObjectDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: modelUrl,
    delegate: "GPU",
  },
  maxResults: maxResults,
  scoreThreshold: scoreThreshold,
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
    const result = model.detectForVideo(event.data.data, event.data.seq);
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
