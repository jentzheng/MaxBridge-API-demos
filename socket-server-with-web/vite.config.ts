import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import websocketServer from "./wsserver";

function socketIOPlugin(): Plugin {
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
  assetsInclude: ["**/*.onnx"],
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],
  },
  plugins: [
    react(),
    tailwindcss(),
    socketIOPlugin(),
    process.env.SELF_SIGN_SSL === "true" && basicSsl(),
  ],
});
