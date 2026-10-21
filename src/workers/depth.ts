import { pipeline, env, LogLevel } from "@huggingface/transformers";

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
  },
);

self.postMessage({ type: "ready" });

const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d", {
  alpha: false,
  desynchronized: true,
});

type FrameMessage = {
  type: "frame";
  data: VideoFrame;
  seq: number;
};

let latestFrame: FrameMessage | null = null;
let running = false;

self.onmessage = (event: MessageEvent<FrameMessage>) => {
  const msg = event.data;
  if (msg.type !== "frame") return;
  latestFrame?.data.close();
  latestFrame = msg;
  void processLatest();
};

async function processLatest() {
  if (running || !ctx) return;
  running = true;
  try {
    while (latestFrame) {
      const msg = latestFrame;
      latestFrame = null;
      const frame = msg.data;
      if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth;
      if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0, frame.displayWidth, frame.displayHeight);
      frame.close();
      const result = await depthEstimator(canvas);
      const depth = result.depth.data;
      self.postMessage(
        {
          type: "result",
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
    }
  } finally {
    running = false;
    if (latestFrame) {
      void processLatest();
    }
  }
}

export type OutgoingMessage = MessageEvent<
  | {
      type: "ready";
    }
  | {
      type: "result";
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
