import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const useLocalModel = import.meta.env.VITE_USE_LOCAL_MODEL;

const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${rootUrl.origin}/models/mediapipe/wasm`;
const localModelUrl = `${rootUrl.origin}/models/mediapipe/hands/hand_landmarker.task`;

const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function initModel(numHands: number) {
  const vision = await FilesetResolver.forVisionTasks(
    useLocalModel ? localWasmUrl : remoteWasmUrl,
    true,
  );
  const model = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: useLocalModel ? localModelUrl : remoteModelUrl,
      delegate: "GPU",
    },
    numHands,
    runningMode: "VIDEO",
  });
  return model;
}

self.postMessage({ type: "READY" });

type IncomingMessage = MessageEvent<
  | { type: "INIT"; numHands: number }
  | {
      type: "FRAME";
      frame: VideoFrame;
      seq: number;
    }
>;
let model: HandLandmarker | null = null;
self.onmessage = ({ data }: IncomingMessage) => {
  if (data.type === "INIT") {
    // Handle initialization if needed
    initModel(data.numHands).then((m) => {
      model = m;
      self.postMessage({ type: "READY" });
    });
  } else if (data.type === "FRAME") {
    if (model) {
      const { landmarks } = model.detectForVideo(data.frame, data.seq);
      self.postMessage({ type: "RESULT", handLandmarks: landmarks });
    }
    data.frame.close();
  }
};

self.onclose = () => {
  model?.close();
};

self.onerror = (err) => {
  console.error("[HandsWorker] Error:", err);
  model?.close();
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "READY";
    }
  | {
      type: "RESULT";
      handLandmarks: NormalizedLandmark[][];
    }
>;
