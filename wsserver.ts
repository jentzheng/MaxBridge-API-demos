import type http from "http";
import type { Http2SecureServer } from "http2";

import url from "url";
import { WebSocketServer, type WebSocket } from "ws";

export default function Server(httpServer: http.Server | Http2SecureServer) {
  const wss = new WebSocketServer({
    noServer: true,
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/ws")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  type Role = "sender" | "receiver";

  const clientSet = new Set<{ username: string; role: Role; socket: WebSocket }>();

  wss.on("connection", (ws, req) => {
    const queryParams = url.parse(req.url!, true).query as { username?: string; role?: string };
    const username = queryParams.username;
    const role = queryParams.role as Role | undefined;

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
