import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// determine whether to use local model or remote model
const useLocalModel = import.meta.env.VITE_USE_LOCAL_MODEL;
const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
const localWasmUrl = `${rootUrl.origin}/models/mediapipe/tasks-vision/wasm`;
const localModelUrl = `${rootUrl.origin}/models/mediapipe/tasks-vision/face_landmarker.task`;
const remoteWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const remoteModelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

async function initModel(numFaces: number) {
  const vision = await FilesetResolver.forVisionTasks(
    useLocalModel ? localWasmUrl : remoteWasmUrl,
    true,
  );

  return await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: useLocalModel ? localModelUrl : remoteModelUrl,
      delegate: "GPU",
    },
    numFaces,
    runningMode: "VIDEO",
  });
}

type IncomingMessage = MessageEvent<
  | {
      type: "INIT";
      numFaces: number;
    }
  | {
      type: "FRAME";
      frame: VideoFrame;
      seq: number;
    }
>;

let model: FaceLandmarker | null = null;

self.onmessage = ({ data }: IncomingMessage) => {
  if (data.type === "INIT") {
    initModel(data.numFaces).then((m) => {
      model = m;
      self.postMessage({ type: "READY" });
    });
  } else if (data.type === "FRAME") {
    if (model) {
      const { faceLandmarks } = model.detectForVideo(data.frame, data.seq);
      self.postMessage({ type: "RESULT", faceLandmarks: faceLandmarks });
    }

    data.frame.close();
  }
};

self.onclose = () => {
  model?.close();
};

self.onerror = (err) => {
  console.error("[FaceLandmarkWorker] Error:", err);
  model?.close();
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "READY";
    }
  | {
      type: "RESULT";
      faceLandmarks: NormalizedLandmark[][];
    }
>;
