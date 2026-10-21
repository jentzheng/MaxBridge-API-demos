import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin, loadEnv } from "vite";
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: process.env.BASE_URL || "/",
    server: {
      host: true,
    },
    worker: {
      format: "es",
    },
    define: {
      "import.meta.env.VITE_USE_LOCAL_MODEL": Boolean(env.VITE_USE_LOCAL_MODEL === "true"),
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
      env.SINGLE_FILE === "true" && viteSingleFile({}),
      env.SELF_SIGN_SSL === "true" &&
        basicSsl({
          domains: ["*.lan"],
          certDir: "./tmp/certs",
        }),
    ],
  };
});
