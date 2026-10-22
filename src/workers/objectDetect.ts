import {
  ObjectDetector,
  FilesetResolver,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

const useLocalModel = import.meta.env.VITE_USE_LOCAL_MODEL;

const appRoot = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${appRoot.origin}/models/mediapipe/wasm`;
const localModelUrl = `${appRoot.origin}/models/mediapipe/object_detector/efficientdet_lite0.tflite`;
const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

async function initModel(maxResults: number, scoreThreshold: number) {
  const vision = await FilesetResolver.forVisionTasks(
    useLocalModel ? localWasmUrl : remoteWasmUrl,
    true,
  );

  return await ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: useLocalModel ? localModelUrl : remoteModelUrl,
      delegate: "GPU",
    },
    maxResults: maxResults,
    scoreThreshold: scoreThreshold,
    runningMode: "VIDEO",
  });
}

type IncomingMessage = MessageEvent<
  | {
      type: "INIT";
      maxResults: number;
      scoreThreshold: number;
    }
  | {
      type: "FRAME";
      frame: VideoFrame;
      seq: number;
    }
>;

let model: ObjectDetector | null = null;

self.onmessage = ({ data }: IncomingMessage) => {
  if (data.type === "INIT") {
    initModel(data.maxResults, data.scoreThreshold).then((m) => {
      model = m;
      self.postMessage({ type: "READY" });
    });
  } else if (data.type === "FRAME") {
    if (model) {
      const result = model.detectForVideo(data.frame, data.seq);
      self.postMessage({ type: "RESULT", result: result });
    }
    data.frame.close();
  }
};

self.onclose = () => {
  model?.close();
};

self.onerror = (err) => {
  console.error("[ObjectDetectWorker] Error:", err);
  model?.close();
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "READY";
    }
  | {
      type: "RESULT";
      result: ObjectDetectorResult;
    }
>;
