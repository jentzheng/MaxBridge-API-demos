"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
outlets = 1;
outlettypes = ["dictionary"];
const options = {
    wsUrl: jsarguments.length > 1
        ? jsarguments[1]
        : "ws://localhost:5173/ws?username=maxmsp&role=receiver",
    users: [],
};
function getUsers() {
    outlet_dictionary(0, { users: options.users });
}
getUsers.local = 0;
const socket = new WebSocket(options.wsUrl);
socket.onopen = () => {
    console.log("WebSocket connected");
};
const decoder = new TextDecoder();
const typeMap = new Map([
    [0, "char"],
    [1, "long"],
    [2, "float32"],
    [3, "float64"],
]);
const matrix = new JitterMatrix();
socket.onmessage = (event) => {
    const data = event.data; // IOBuffer
    if (data instanceof Uint8Array) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let offset = 0;
        // 1. matrixName length
        const nameLen = view.getUint8(offset);
        offset += 1;
        // @ts-expect-error 'data.slice' is deprecated
        const matrixName = decoder.decode(data.slice(offset, offset + nameLen));
        offset += nameLen;
        const planeCount = view.getUint8(offset);
        offset += 1;
        const typeNum = view.getUint8(offset);
        const type = typeMap.get(typeNum);
        offset += 1;
        const width = view.getUint16(offset, false);
        offset += 2;
        const height = view.getUint16(offset, false);
        offset += 2;
        const pixelBytes = data.slice(offset);
        matrix.name = matrixName;
        matrix.type = type;
        matrix.planecount = planeCount;
        if (matrix.dim[0] !== width || matrix.dim[1] !== height) {
            matrix.dim = [width, height];
        }
        if (type === "char") {
            const pixelData = new Uint8Array(pixelBytes.buffer);
            if (pixelData.length === 0)
                return;
            matrix.copyarraytomatrix(pixelData);
        }
        else if (type === "float32") {
            const pixelData = new Float32Array(pixelBytes.buffer);
            if (pixelData.length === 0)
                return;
            matrix.copyarraytomatrix(pixelData);
        }
    }
    else if (typeof data === "string") {
        const message = JSON.parse(data);
        if (message.type === "users") {
            options.users = message.users;
        }
    }
};
