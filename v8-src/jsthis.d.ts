type MaxMatrixType = "char" | "long" | "float32" | "float64";
type MaxMatrixData = Uint8Array | Int32Array | Float32Array | Float64Array;

type WebSocket = import("ws").WebSocket;
declare const WebSocket: typeof import("ws").WebSocket;

type WebSocketServer = import("ws").WebSocketServer;
declare const WebSocketServer: typeof import("ws").WebSocketServer;

declare let autowatch: 0 | 1;
declare let inlets: number;
declare let outlets: number;
declare let inlet: number;
declare let messagename: string;
declare let outlettypes: string[];

declare class JitterMatrix {
  constructor(planecount?: number, dataType?: MaxMatrixType, columns?: number, rows?: number);
  name: string;
  type: MaxMatrixType;
  planecount: number;
  dim: number[];
  adapt: 0 | 1;
  copyarraytomatrix(data: MaxMatrixData | ArrayBufferView): void;
  copymatrixtoarray(data: MaxMatrixData): void;
  clear(): void;
}

declare const outlet: (index: number, ...args: unknown[]) => void;

declare class Global {
  constructor(name: string);
  readonly name: string;
  [property: string]: unknown;
}
