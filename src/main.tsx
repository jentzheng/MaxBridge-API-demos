import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import { routeTree } from "./routeTree.gen";
import "./styles.css";

const hashHistory = createHashHistory();
// const history = createHistory();

const router = createRouter({
  routeTree,
  // history: hashHistory,
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
  const websocket = useWebSocket(wsAddress);
  return <RouterProvider router={router} context={{ websocket }} />;
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
