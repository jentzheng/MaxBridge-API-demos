import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// handle URL parameters
const urlParams = new URLSearchParams(self.location.search);
const numFaces = parseInt(urlParams.get("numFaces") || "3");

// determine whether to use local model or remote model
const useLocalModel = import.meta.env.VITE_USE_LOCAL_MODEL;
const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${rootUrl.origin}/models/mediapipe/wasm`;
const localModelUrl = `${rootUrl.origin}/models/mediapipe/face_landmarker/float16/1/face_landmarker.task`;
const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const vision = await FilesetResolver.forVisionTasks(
  useLocalModel ? localWasmUrl : remoteWasmUrl,
  true,
);

const model = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: useLocalModel ? localModelUrl : remoteModelUrl,
    delegate: "GPU",
  },
  numFaces: numFaces,
  runningMode: "VIDEO",
});

self.postMessage({ type: "ready" });

type IncomingMessage = MessageEvent<{
  type: "frame";
  data: VideoFrame;
  seq: number;
}>;

let latestId = 0;

self.onmessage = async (event: IncomingMessage) => {
  if (event.data.type === "frame") {
    if (event.data.seq <= latestId) {
      console.warn(`[FaceLandmarkWorker] Dropping out-of-order frame: ${event.data.seq}`);
      event.data.data.close();
      return;
    }
    latestId = event.data.seq;

    const { faceLandmarks } = model.detectForVideo(event.data.data, event.data.seq);
    event.data.data.close();

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
