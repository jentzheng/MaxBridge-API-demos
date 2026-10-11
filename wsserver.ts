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

  const senderSocketMap = new Map<string, WebSocket>();
  const receiverSocketMap = new Map<string, WebSocket>();

  wss.on("connection", (ws, req) => {
    const queryParams = url.parse(req.url!, true).query as { username?: string; role?: string };

    const user = queryParams.username;
    const role = queryParams.role;
    if (!user || !role) {
      ws.close(1008, "Username is required");
      return;
    }

    const hasSender = role === "sender";
    const hasReceiver = role === "receiver";

    if (hasReceiver) {
      console.log("Receiver connected:", user);
      receiverSocketMap.get(user)?.close(1000, "Replaced by a new receiver");
      receiverSocketMap.set(user, ws);
    }

    if (hasSender) {
      console.log("Sender connected:", user);
      senderSocketMap.get(user)?.close(1000, "Replaced by a new sender");
      senderSocketMap.set(user, ws);

      ws.on("message", (data, isBinary) => {
        receiverSocketMap.forEach((receiver) => {
          if (receiver !== ws && receiver.readyState === receiver.OPEN) {
            receiver.send(data, { binary: isBinary });
          }
        });
      });
    }

    ws.on("close", () => {
      if (senderSocketMap.get(user) === ws) {
        senderSocketMap.delete(user);
      }
      if (receiverSocketMap.get(user) === ws) {
        receiverSocketMap.delete(user);
      }
      console.log("Connection closed:", user);
    });
  });

  wss.on("close", () => {
    senderSocketMap.clear();
    receiverSocketMap.clear();
  });

  return wss;
}
