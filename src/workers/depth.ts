import { pipeline, env, LogLevel, type ProgressInfo } from "@huggingface/transformers";

const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
env.logLevel = LogLevel.ERROR;

if (import.meta.env.VITE_USE_LOCAL_MODEL) {
  env.remoteHost = rootUrl.origin + "/models/transformers/";
  env.remotePathTemplate = "{model}/";
  env.backends.onnx.wasm!.wasmPaths = rootUrl.origin + "/models/transformers/";
}

const depthEstimator = await pipeline(
  "depth-estimation",
  "onnx-community/depth-anything-v2-small-ONNX",
  {
    device: "webgpu",
    dtype: "fp16",
    progress_callback: (p) => {
      self.postMessage({ type: "READY", info: p });
    },
  },
);

const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d", {
  alpha: false,
  willReadFrequently: true,
});

type IncomingMessage = MessageEvent<{
  type: "FRAME";
  frame: VideoFrame;
  seq: number;
}>;

let isProcessing = false;
let pendingFrame: IncomingMessage["data"] | null = null;

self.onmessage = ({ data }: IncomingMessage) => {
  if (data.type === "FRAME") {
    if (isProcessing) {
      pendingFrame?.frame.close();
      pendingFrame = data;
      return;
    }
    void processLatest(data.frame, data.seq);

    data.frame.close();
  }
};

async function processLatest(frame: VideoFrame, seq: number) {
  isProcessing = true;
  try {
    if (!ctx) return;
    if (canvas.width !== frame.displayWidth) {
      canvas.width = frame.displayWidth;
    }
    if (canvas.height !== frame.displayHeight) {
      canvas.height = frame.displayHeight;
    }
    ctx.drawImage(frame, 0, 0);
    frame.close();
    const result = await depthEstimator(canvas);
    const depth = result.depth.data;
    self.postMessage(
      {
        type: "RESULT",
        result: {
          depth: {
            data: depth,
            width: result.depth.width,
            height: result.depth.height,
            channels: result.depth.channels,
          },
        },
      },
      [depth.buffer],
    );
  } finally {
    isProcessing = false;
    const next = pendingFrame;
    pendingFrame = null;
    if (next) {
      void processLatest(next.frame, next.seq);
    }
  }
}

export type OutgoingMessage = MessageEvent<
  | {
      type: "READY";
      info: ProgressInfo;
    }
  | {
      type: "RESULT";
      result: {
        depth: {
          data: Float32Array;
          width: number;
          height: number;
          channels: number;
        };
      };
    }
>;
