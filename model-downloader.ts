import fs from "fs";
import path from "path";

const mediapipeWasm = {
  name: "wasm",
  items: [
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_module_internal.js",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_module_internal.wasm",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_nosimd_internal.js",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_nosimd_internal.wasm",
  ],
  dest: "/models/mediapipe/tasks-vision/wasm",
};

const modelFiles = [
  {
    name: "face_landmarker",
    remote:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    dest: "/models/mediapipe/tasks-vision/face_landmarker.task",
  },
  {
    name: "hand_landmarker",
    remote:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    dest: "/models/mediapipe/tasks-vision/hand_landmarker.task",
  },
  {
    name: "object_detector",
    remote:
      "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
    dest: "/models/mediapipe/tasks-vision/efficientdet_lite0.tflite",
  },
];

async function downloadFile(url: string, dest: string) {
  const rootPath = path.dirname("./public" + dest);
  fs.mkdirSync(rootPath, { recursive: true });
  const filePath = path.join(rootPath, path.basename(dest));
  console.log(`Downloading to ${filePath}`);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

for (const file of modelFiles) {
  await downloadFile(file.remote, file.dest);
}

for (const url of mediapipeWasm.items) {
  await downloadFile(url, mediapipeWasm.dest + "/" + path.basename(url));
}

process.exit();
