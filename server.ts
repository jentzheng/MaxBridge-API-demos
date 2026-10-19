import { createAdaptorServer, upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { WebSocketServer } from "ws";

import wssHandler from "./wsserverHandler.ts";

const { certificate, key } = JSON.parse(readFileSync("../tmp/certs/acme.json", "utf8")) as {
  certificate: string;
  key: string;
};

const app = new Hono();
const port = 8443;
app.use(
  "*",
  serveStatic({
    root: "./client",
  }),
);
app.get(
  "/ws",
  upgradeWebSocket(() => ({})),
);

const wss = wssHandler(new WebSocketServer({ noServer: true }));
const server = createAdaptorServer({
  port,
  fetch: app.fetch,
  createServer,
  websocket: { server: wss },
  serverOptions: {
    key: Buffer.from(key, "base64"),
    cert: Buffer.from(certificate, "base64"),
  },
});
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
