import { createContext, useContext } from "react";
import type WebRTCConnection from "./webRTCConnection";

export type ConnectionState = {
  isSocketConnect: boolean;
  peerState: string;
  dataChannelState: string;
};

export const ConnectionContext = createContext<{
  webRTCConnection?: WebRTCConnection;
  dataChannel?: RTCDataChannel;
  connectionState?: ConnectionState;
}>({});

export function useConnection() {
  const context = useContext(ConnectionContext);
  return context;
}
