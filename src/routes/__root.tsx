import type useWebSocket from "react-use-websocket";

import { useForm } from "@tanstack/react-form";
import { Link, Outlet, createRootRouteWithContext, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ReadyState } from "react-use-websocket";
import { z } from "zod";

const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
// const wsPort = Number(window.location.port);

const searchParam = z.object({
  // host: z.string().default("localhost"),
  // port: z.number().default(5173),
  wsaddress: z.string().default(`${wsProto}//${window.location.host}/ws`),
  username: z.string().default("Guest"),
});

export const Route = createRootRouteWithContext<{
  websocket: ReturnType<typeof useWebSocket>;
}>()({
  component: RootComponent,
  // searchparams
  validateSearch: searchParam,
});

function RootComponent() {
  const { websocket } = Route.useRouteContext();
  const { getWebSocket, readyState } = websocket;
  const searchParams = Route.useSearch();
  const location = useLocation();
  const navigate = Route.useNavigate();

  const form = useForm({
    defaultValues: {
      wsaddress: searchParams.wsaddress,
      username: searchParams.username,
    },
    validators: {
      onChange: z.output(searchParam),
    },
    onSubmit: async ({ value }) => {
      // Do something with form data
      navigate({
        to: location.pathname,
        search: (prev) => ({ ...prev, username: value.username, wsaddress: value.wsaddress }),
        replace: true,
      }).then(() => {
        window.location.reload();
      });
    },
  });
  const [users, setUsers] = useState<string[]>([]);

  const connectionStatus = useMemo(() => {
    return {
      [ReadyState.CONNECTING]: "Connecting",
      [ReadyState.OPEN]: "Open",
      [ReadyState.CLOSING]: "Closing",
      [ReadyState.CLOSED]: "Closed",
      [ReadyState.UNINSTANTIATED]: "Uninstantiated",
    }[getWebSocket()?.readyState || ReadyState.UNINSTANTIATED];
  }, [getWebSocket]);

  useEffect(() => {
    const ws = getWebSocket();
    if (!ws) return;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "users") {
        setUsers(data.users);
      }
    };
  }, [getWebSocket]);

  return (
    <div className="drawer min-h-dvh lg:drawer-open justify-stretch ">
      <input id="my-drawer" type="checkbox" className="drawer-toggle inline" />
      <div className="drawer-content h-full max-h-dvh flex flex-col">
        {/* Navbar */}
        <nav className="navbar w-full bg-base-300">
          <label
            htmlFor="my-drawer"
            aria-label="open sidebar"
            className="btn btn-square btn-ghost drawer-button lg:hidden"
          >
            {/* Sidebar toggle icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="2"
              fill="none"
              stroke="currentColor"
              className="my-1.5 inline-block size-4"
            >
              <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
              <path d="M9 4v16"></path>
              <path d="M14 10l2 2l-2 2"></path>
            </svg>
          </label>
          <div className="px-4">MaxBridge Demos</div>
          <ul className="menu menu-horizontal px-1">
            <li>
              <Link
                to="/"
                search={() => {
                  return {
                    username: searchParams.username,
                    wsaddress: searchParams.wsaddress,
                  };
                }}
              >
                CamOnly
              </Link>
            </li>
            <li>
              <Link
                to="/faceLandmark"
                search={() => {
                  return {
                    username: searchParams.username,
                    wsaddress: searchParams.wsaddress,
                  };
                }}
              >
                FaceLandmark
              </Link>
            </li>
            <li>
              <Link
                to="/objectDetect"
                search={() => {
                  return {
                    username: searchParams.username,
                    wsaddress: searchParams.wsaddress,
                  };
                }}
              >
                ObjectDetector
              </Link>
            </li>
          </ul>
        </nav>
        {/* Page content here */}
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>

      <div className="drawer-side">
        <label htmlFor="my-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        {/* Sidebar content here */}
        <div className="min-h-full max-w-xs bg-gray-800 p-4">
          {!window.max && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
              >
                <fieldset className="fieldset bg-base-200 border-base-300 rounded-box   border p-2">
                  <legend className="fieldset-legend">WebSocket Status {connectionStatus}</legend>

                  <form.Field
                    name="username"
                    children={(field) => {
                      return (
                        <label className="form-control w-full">
                          <div className="label">
                            <span className="label-text">username</span>
                          </div>
                          <input
                            className="input input-bordered w-full"
                            name={field.name}
                            type="text"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        </label>
                      );
                    }}
                  />
                  <form.Field
                    name="wsaddress"
                    children={(field) => {
                      return (
                        <label className="form-control w-full">
                          <div className="label">
                            <span className="label-text">WebSocket Address</span>
                          </div>
                          <input
                            className="input input-bordered w-full"
                            name={field.name}
                            type="text"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        </label>
                      );
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary w-full mt-4"
                    disabled={connectionStatus === "Connecting"}
                  >
                    Refresh
                  </button>
                </fieldset>
              </form>
              <div className="mt-4">
                <h2 className="text-lg font-bold">Connected Users</h2>
                <ul>
                  {users.map((user, index) => (
                    <li key={index}>{user}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
