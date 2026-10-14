import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

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
  return <RouterProvider router={router} />;
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
