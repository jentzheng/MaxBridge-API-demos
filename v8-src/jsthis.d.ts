declare const WebSocket: typeof import("ws").WebSocket;
declare const WebSocketServer: typeof import("ws").WebSocketServer;

declare function outlet_dictionary(index: number, dict: Record<string, unknown>): void;
declare let outlettypes: string[];

type MaxMatrixType = "char" | "long" | "float32" | "float64";
interface JitterMatrix {
  copyarraytomatrix(
    array: Uint8Array | Uint8ClampedArray | Int32Array | Float32Array | Float64Array,
  ): void;
}
