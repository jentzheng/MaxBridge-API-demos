import { pipeline, env, LogLevel } from "@huggingface/transformers";
const rootUrl = new URL(import.meta.env.BASE_URL, import.meta.url);
env.logLevel = LogLevel.INFO;
env.remoteHost = rootUrl.origin + "/models/transformers/";
env.remotePathTemplate = "{model}/";
env.backends.onnx.wasm!.wasmPaths = rootUrl.origin + "/models/transformers/";

const depth_estimator = await pipeline(
  "depth-estimation",
  "onnx-community/depth-anything-v2-small-ONNX",
  {
    device: "webgpu",
    dtype: "fp16",
  },
);

type IncomingMessage = MessageEvent<{
  type: "frame";
  data: VideoFrame;
  seq: number;
}>;

const inputSize = 100;
const canvas = new OffscreenCanvas(inputSize, inputSize);
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });

self.onmessage = async (event: IncomingMessage) => {
  if (event.data.type !== "frame") return;
  if (!ctx) return;
  const frame = event.data.data;
  ctx.drawImage(frame, 0, 0, frame.displayWidth, frame.displayHeight, 0, 0, inputSize, inputSize);
  frame.close();
  const result = await depth_estimator(canvas);
  self.postMessage({ type: "result", result: { depth: result.depth } });
};

export type OutgoingMessage = MessageEvent<
  | {
      type: "ready";
    }
  | {
      type: "result";
      result: {
        depth: {
          data: Uint8Array;
          width: number;
          height: number;
          channels: number;
        };
      };
    }
>;
