import type { UYVYFrame } from "../libs/webgl";

type MatrixType = "char" | "long" | "float32" | "float64";

const typeMap = new Map<MatrixType, number>([
  ["char", 0],
  ["long", 1],
  ["float32", 2],
  ["float64", 3],
]);

export function writeJitMatBuffer(
  name: string,
  planecount: number,
  type: MatrixType,
  width: number,
  height: number,
  data: Float32Array | Uint8Array | Float64Array | Int32Array,
): ArrayBuffer {
  const nameBuf = new TextEncoder().encode(name);
  const headerSize = 1 + nameBuf.byteLength + 1 + 1 + 2 + 2;

  const packet = new ArrayBuffer(headerSize + data.byteLength);
  const view = new DataView(packet);
  // 6. Data (remaining bytes)
  const bytes = new Uint8Array(packet);

  let offset = 0;
  // 1. Name length (1 byte)
  view.setUint8(offset, nameBuf.byteLength);
  offset += 1;

  bytes.set(nameBuf, offset);
  offset += nameBuf.byteLength;

  // 2. Plane count (1 byte)
  view.setUint8(offset, planecount);
  offset += 1;
  // 3. Type (1 byte)
  view.setUint8(offset, typeMap.get(type)!);
  offset += 1;
  // 4. width (4 bytes, big-endian)
  view.setUint16(offset, width, false);
  offset += 2;
  // 5. height (2 bytes, big-endian)
  view.setUint16(offset, height, false);
  offset += 2;

  bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset);
  return packet;
}
