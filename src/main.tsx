import type useWebSocketType from "react-use-websocket";

import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as reactUseWebsocket from "react-use-websocket";

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
  const wsAddress = router.latestLocation.search.wsaddress!;
  const username = router.latestLocation.search.username!;
  // @ts-ignore
  // @ts-expect-error
  const useWebSocket = reactUseWebsocket.default.default;
  const websocket = useWebSocket(
    wsAddress,
    {
      queryParams: { username, role: "sender" },
      onOpen: () => {
        websocket.sendJsonMessage({ type: "setUser", username });
      },
      onClose: () => {
        websocket.sendJsonMessage({ type: "removeUser", username });
      },
    },
    !window.max,
  );

  return <RouterProvider router={router} context={{ websocket }} />;
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
