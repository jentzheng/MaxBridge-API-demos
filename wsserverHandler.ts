import { WebSocketServer, type WebSocket } from "ws";

export default function wssHandler(wss: WebSocketServer) {
  type Role = "sender" | "receiver";
  const clientSet = new Set<{ username: string; role: Role; socket: WebSocket }>();

  wss.on("connection", (ws, req) => {
    const origin = req.headers.origin || "http://localhost";
    if (!req.url) return;
    const queryParams = new URL(req.url, origin).searchParams;
    const username = queryParams.get("username");
    const role = queryParams.get("role") as Role | undefined;

    if (!username || !role) {
      ws.close(1008, "Username is required");
      return;
    }
    const client = { username, role, socket: ws };
    clientSet.add(client);
    clientSet.forEach(({ socket }) => {
      socket.send(
        JSON.stringify({
          type: "users",
          users: Array.from(clientSet).map(({ username, role }) => `${username} - ${role}`),
        }),
      );
    });

    ws.on("message", (data, isBinary) => {
      if (data instanceof Buffer) {
        clientSet.forEach(({ socket: receiver, role: r }) => {
          if (r === "receiver") {
            receiver.send(data, {
              compress: true,
              binary: isBinary,
            });
          }
        });
      }
    });

    ws.on("close", () => {
      clientSet.delete(client);
      clientSet.forEach(({ socket, username }) => {
        socket.send(
          JSON.stringify({
            type: "users",
            users: Array.from(clientSet).map(({ username, role }) => `${username} - ${role}`),
          }),
        );
        console.log("sending users list to", username);
      });
    });
  });

  wss.on("close", () => {
    clientSet.clear();
  });

  return wss;
}
