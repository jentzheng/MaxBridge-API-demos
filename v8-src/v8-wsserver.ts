outlets = 1;
// outlettypes = ["dictionary"];

const wss = new WebSocketServer({ port: 8081, host: "0.0.0.0" });

const typeMap = new Map<number, MaxMatrixType>([
  [0, "char"],
  [1, "long"],
  [2, "float32"],
  [3, "float64"],
]);
const matrix = new JitterMatrix();
const decoder = new TextDecoder();

type IncomingJson = {
  type: "setUser" | "removeUser";
  username: string;
};

const users = new Set<{ id: string; username: string; socket: WebSocket }>();

function getUsers() {
  outlet_dictionary(0, { users: Array.from(users).map(({ username }) => username) });
}

function randomUUID() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
}
randomUUID.local = 1;

function broadcastUsers() {
  users.forEach(({ socket }) => {
    socket.send(JSON.stringify({ type: "users", users: Array.from(users) }));
  });
}

wss.on("connection", (socket) => {
  const user = {
    id: randomUUID(),
    username: "",
    socket,
  };
  users.add(user);
  broadcastUsers();

  socket.onmessage = (event) => {
    if (event.data instanceof Uint8Array) {
      const data = event.data; // IOBuffer

      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

      let offset = 0;
      // 1. matrixName length
      const nameLen = view.getUint8(offset);
      offset += 1;
      const matrixName = decoder.decode(data.slice(offset, offset + nameLen));
      offset += nameLen;
      const planeCount = view.getUint8(offset);
      offset += 1;
      const typeNum = view.getUint8(offset);
      const type = typeMap.get(typeNum)!;
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
        matrix.copyarraytomatrix(pixelData);
      } else if (type === "float32") {
        const pixelData = new Float32Array(pixelBytes.buffer);
        matrix.copyarraytomatrix(pixelData);
      }
    } else {
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data) as IncomingJson;
        if (message.type === "setUser") {
          // check if the username is already taken
          if (Array.from(users).some(({ username }) => username === message.username)) {
            socket.close();
            return;
          }

          user.username = message.username;
          broadcastUsers();
        }
      }
    }
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
    users.delete(user);
    broadcastUsers();
  };
});

wss.on("close", () => {
  console.log("WebSocket server closed");
  matrix.clear();
});

export {};
