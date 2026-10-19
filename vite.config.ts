import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { WebSocketServer } from "ws";

import wssHandler from "./wsserverHandler.ts";

function websocketPlugin(): Plugin {
  return {
    name: "websocket-plugin",
    configureServer(server) {
      if (!server.httpServer) return;
      const wss = wssHandler(new WebSocketServer({ noServer: true }));
      server.httpServer.on("upgrade", (request, socket, head) => {
        if (request.url?.startsWith("/ws")) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        }
      });
    },
    configurePreviewServer(server) {
      if (!server.httpServer) return;
      const wss = wssHandler(new WebSocketServer({ noServer: true }));
      server.httpServer.on("upgrade", (request, socket, head) => {
        if (request.url?.startsWith("/ws")) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_URL || "/",
  server: {
    host: true,
  },
  worker: {
    format: "es",
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    websocketPlugin(),
    process.env.SINGLE_FILE === "true" && viteSingleFile({}),
    process.env.SELF_SIGN_SSL === "true" &&
      basicSsl({
        domains: ["*.lan"],
        certDir: "./tmp/certs",
      }),
  ],
});
