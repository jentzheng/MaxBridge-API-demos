import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import tsconfigPaths from "vite-tsconfig-paths";

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
  worker: {
    format: "es",
  },
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    websocketPlugin(),
    process.env.SINGLE_FILE === "true" && viteSingleFile({}),
    process.env.SELF_SIGN_SSL === "true" && basicSsl(),
  ],
});
