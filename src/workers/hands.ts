import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";
const urlParams = new URLSearchParams(self.location.search);
const numHands = parseInt(urlParams.get("numHands") || "3");

// handle URL parameters

const useLocalModel = Boolean(import.meta.env.VITE_USE_LOCAL_MODEL === "true");

const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${rootUrl.origin}/models/mediapipe/wasm`;
const localModelUrl = `${rootUrl.origin}/models/mediapipe/hands/hand_landmarker.task`;

const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

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

self.postMessage({ type: "ready" });

type IncomingMessage = MessageEvent<{
  type: "frame";
  data: ImageBitmap;
  seq: number;
}>;

self.onmessage = async (event: IncomingMessage) => {
  if (event.data.type === "frame") {
    const { landmarks } = model.detectForVideo(event.data.data, event.data.seq);
    event.data.data.close();
    self.postMessage({ type: "result", handLandmarks: landmarks });
  }
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "ready";
    }
  | {
      type: "result";
      handLandmarks: NormalizedLandmark[][];
    }
>;
