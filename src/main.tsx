import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import { routeTree } from "./routeTree.gen";
import "./styles.css";

const hashHistory = createHashHistory();

const router = createRouter({
  routeTree,
  history: hashHistory,
  context: {
    websocket: undefined!,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;

export function App() {
  const origin = new URL(router.origin);
  const wsProtocol = origin.protocol === "https:" ? "wss:" : "ws:";
  const wsURL = new URL(`${wsProtocol}//${origin.host}/ws`);

  const username = router.latestLocation.search.username || "Guest";
  const wshook = useWebSocket(
    wsURL.toString(),
    {
      queryParams: {
        username: username,
        role: "sender",
      },
    },
    !window.max,
  );

  return (
    <RouterProvider
      router={router}
      context={{
        websocket: wshook,
      }}
    />
  );
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
