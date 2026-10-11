import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

import websocketServer from "./wsserver.ts";

function websocketPlugin(): Plugin {
  return {
    name: "websocket-plugin",
    configureServer(server) {
      if (!server.httpServer) return;
      websocketServer(server.httpServer);
    },
    configurePreviewServer(server) {
      if (!server.httpServer) return;
      websocketServer(server.httpServer);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    websocketPlugin(),
    viteSingleFile({}),
    process.env.SELF_SIGN_SSL === "true" && basicSsl(),
  ],
});
