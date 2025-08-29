import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useSearchParams } from "react-router";
import SignalingClient, { type Client } from "./utils/signalingClient";
import WebRTCConnection from "./utils/webRTCConnection";
import { ConnectionContext, type ConnectionState } from "./utils/hooks";

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formState, setFormState] = useState({
    username: searchParams.get("username") || "Chrome#1",
    address:
      searchParams.get("address") ||
      `${window.location.protocol === "http:" ? "ws://" : "wss://"}${
        window.location.hostname
      }:${window.location.port}/ws`,
    jitRecvPort: searchParams.get("jitRecvPort") || 7575,
  });

  const [socketClient, setSocketClient] = useState<SignalingClient>();
  const [clients, setClients] = useState<Client[]>([]);

  const [webRTCConnection, setWebRTCConnection] = useState<WebRTCConnection>();
  const [dataChannel, setDataChannel] = useState<RTCDataChannel>();

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isSocketConnect: false,
    peerState: "unknown",
    dataChannelState: "unknown",
  });

  useEffect(() => {
    setSearchParams({
      username: formState.username,
      address: formState.address,
      jitRecvPort: formState.jitRecvPort.toString(),
    });
  }, [formState, setSearchParams]);

  // initial rendering
  const username = searchParams.get("username");
  const address = searchParams.get("address");
  const jitRecvPort = searchParams.get("jitRecvPort");

  useEffect(() => {
    const signalingClient = new SignalingClient(setConnectionState, setClients);

    if (address && username && jitRecvPort) {
      const url = new URL(address);
      url.searchParams.set("username", username);
      url.searchParams.set("role", "browser");
      url.searchParams.set("jitRecvPort", jitRecvPort);
      signalingClient.connect(url);
    }

    setSocketClient(signalingClient);

    const webRTCConnection = new WebRTCConnection(
      signalingClient,
      setDataChannel
    );

    setWebRTCConnection(webRTCConnection);

    return () => {
      signalingClient.disconnect();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleConnect = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const url = new URL(formState.address);
      url.searchParams.set("username", formState.username);
      url.searchParams.set("role", "browser");
      url.searchParams.set("jitRecvPort", formState.jitRecvPort.toString());

      if (connectionState.isSocketConnect) {
        socketClient?.disconnect();
      } else {
        socketClient?.connect(url);
      }
    },
    [socketClient, connectionState, formState]
  );

  // auto connect rtc
  // useEffect(() => {
  //   if (connectionState.peerState !== "connected") {
  //     const jitterClient = clients.find((c) => c.properties.role === "jitter");
  //     // if (jitterClient) {
  //     //   webRTCConnection?.onCallStart(
  //     //     jitterClient.id,
  //     //     jitterClient?.properties
  //     //   );
  //     // }
  //   }
  // }, [clients, webRTCConnection]);

  return (
    <div className="drawer lg:drawer-open">
      {/* Sidebar Toggle Button */}
      <input id="sidebar-toggle" type="checkbox" className="drawer-toggle" />
      {/* Main Layout */}
      <div className="drawer-content min-h-screen flex flex-col">
        {/* Header: hamburger + nav links */}
        <header className="flex items-center gap-4 px-4 py-2  bg-base-100">
          <label
            htmlFor="sidebar-toggle"
            className="btn btn-square btn-ghost lg:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </label>

          <nav
            role="tablist"
            className="tabs tabs-bordered flex-grow overflow-x-auto"
          >
            <NavLink
              role="tab"
              className={({ isActive }) =>
                isActive ? "tab tab-active" : "tab"
              }
              to="/"
            >
              Test
            </NavLink>
            <NavLink
              role="tab"
              className={({ isActive }) =>
                isActive ? "tab tab-active" : "tab"
              }
              to="/camera"
            >
              Camera
            </NavLink>
            <NavLink
              role="tab"
              className={({ isActive }) =>
                isActive ? "tab tab-active" : "tab"
              }
              to="/detection"
            >
              Detection
            </NavLink>
            <NavLink
              role="tab"
              className={({ isActive }) =>
                isActive ? "tab tab-active" : "tab"
              }
              to="/facelandmark"
            >
              Face Landmark
            </NavLink>
          </nav>
        </header>
        {/* Main Content */}
        <main className="bg-gray-600 flex-1   ">
          <ConnectionContext.Provider
            value={{
              webRTCConnection: webRTCConnection,
              dataChannel,
              connectionState,
            }}
          >
            <Outlet />
          </ConnectionContext.Provider>
        </main>
      </div>

      <aside className="drawer-side ">
        <label htmlFor="sidebar-toggle" className="drawer-overlay"></label>

        <div className="min-h-full bg-base-200">
          <form onSubmit={handleConnect} className="p-4">
            <div className="grid gap-4">
              {/* <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">id</span>
                </div>
                <input
                  type="text"
                  name="id"
                  className="input input-bordered w-full"
                  disabled={true}
                  value={localStorage.getItem("localId") || undefined}
                />
                <p className="label text-sm">presist in local storage</p>
              </label> */}

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">username</span>
                </div>
                <input
                  type="text"
                  name="username"
                  className="input input-bordered w-full"
                  disabled={connectionState.isSocketConnect}
                  value={formState.username}
                  onChange={handleChange}
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">address</span>
                </div>
                <input
                  type="text"
                  name="address"
                  className="input input-bordered w-full"
                  disabled={connectionState.isSocketConnect}
                  value={formState.address}
                  onChange={handleChange}
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Jit Recv Port</span>
                </div>
                <input
                  type="text"
                  name="jitRecvPort"
                  className="input input-bordered w-full"
                  disabled={connectionState.isSocketConnect}
                  value={formState.jitRecvPort}
                  onChange={handleChange}
                />
              </label>

              <button type="submit" className="btn btn-primary">
                {connectionState.isSocketConnect ? "Disconnect" : "Connect"}
              </button>
            </div>
          </form>

          <ul className="my-4 p-4 text-xs">
            <li>{`Socket status: ${connectionState.isSocketConnect}`}</li>
            <li>PC state: {connectionState.peerState}</li>
            <li>DC state: {connectionState.dataChannelState}</li>
          </ul>

          <ul className="list my-4 p-4">
            <li className="text-sm tracking-wide">WebSocket Clients</li>
            {clients.map((client, i) => {
              return (
                <li key={i} className="list-row gap-2 p-0">
                  <div>
                    <p>{String(client.properties.username)}</p>
                    <p className="text-xs text-info">{client.id}</p>
                  </div>
                  <div className="ml-auto gap-2 flex">
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() =>
                        webRTCConnection?.onCallStart(
                          client.id,
                          client.properties
                        )
                      }
                    >
                      Call
                    </button>
                    <button
                      className="btn btn-warning btn-xs"
                      onClick={() => webRTCConnection?.onCallEnd()}
                    >
                      Hang Up
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default App;
