// definition file for TypeScript global declarations

type StreamingOptions = {
  queue: number;
  drop: "oldest" | "newest";
};

type JitterImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

type JitterMatrix =
  | { type: "char"; planecount: number; dim: number[]; data: Uint8Array }
  | { type: "long"; planecount: number; dim: number[]; data: Int32Array }
  | { type: "float32"; planecount: number; dim: number[]; data: Float32Array }
  | { type: "float64"; planecount: number; dim: number[]; data: Float64Array };

type StreamingMetadata = {
  timestamp: number;
  seq: number;
  received: number;
  dropped: number;
};

type MaxDict = Record<string, number | string | MaxArray | MaxDict>;

interface Max {
  bindInlet(name: string, callback: (args?: any[]) => void): void;
  post(message: string): void;
  outlet(initial: number | string, ...args: (number | string)[] | undefined): void;
  bindJitterImage(
    callback: (args: JitterImage & StreamingMetadata) => void,
    opts?: StreamingOptions,
  ): void;
  bindJitterMatrix(
    callback: (args: JitterMatrix & StreamingMetadata) => void,
    opts?: StreamingOptions,
  ): void;
  setJitterMatrix(name: string, matrix: JitterMatrix): void;
  setDict(name: string, dict: MaxDict): void;
  setJitterMatrix(name: string, matrix: JitterMatrix): void;
}

interface Window {
  max?: Max;
}
