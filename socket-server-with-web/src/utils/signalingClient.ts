import type { ConnectionState } from "./hooks";
import type WebRTCConnection from "./webRTCConnection";

export type Client = {
  id: string;
  address: string;
  properties: { timeJoined: number } & { [key: string]: unknown };
};

type SignalingTypeMap = {
  ClientEnter: Client;
  ClientEntered: Client;
  ClientExit: Client;
  Clients: Client[];
  Offer: RTCSessionDescriptionInit;
  Answer: RTCSessionDescriptionInit;
  Ice: RTCIceCandidate;
};

export type SignalingMessage = {
  [K in keyof SignalingTypeMap]: {
    metadata?: unknown;
    signalingType: K;
    sender?: string;
    senderName?: string;
    target?: string;
    content: SignalingTypeMap[K];
  };
}[keyof SignalingTypeMap];

export default class SignalingClient {
  id: string;
  assignedAddress?: string;
  properties: Client["properties"];
  clients: Client[];
  webSocket?: WebSocket;
  webRTCConnection?: WebRTCConnection;
  setConnectionState: React.Dispatch<React.SetStateAction<ConnectionState>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;

  constructor(
    // socketServerUrl: string | URL,
    setConnectionState: React.Dispatch<React.SetStateAction<ConnectionState>>,
    setClients: React.Dispatch<React.SetStateAction<Client[]>>
  ) {
    this.setConnectionState = setConnectionState;
    this.setClients = setClients;

    // let localId = localStorage.getItem("localId");
    // if (!localId) {
    //   localId = crypto.randomUUID();
    //   localStorage.setItem("localId", localId);
    // }

    this.id = Math.random().toString(36).slice(2);
    this.clients = [];
    this.properties = { username: "unknown", role: "unknown", timeJoined: -1 };
  }

  connect(socketServerUrl: string | URL) {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      console.warn("WebSocket already open.");
      return;
    }

    (socketServerUrl as URL).searchParams.set("id", this.id);

    this.webSocket = new WebSocket(socketServerUrl);

    //listeners
    this.webSocket.onopen = () => {
      this.setConnectionState((prev) => ({
        ...prev,
        isSocketConnect: true,
      }));
    };

    this.webSocket.onclose = () => {
      console.log("[WEBSOCKET] Client closed ");
      this.setConnectionState((prev) => ({
        ...prev,
        isSocketConnect: false,
      }));
    };

    this.webSocket.onerror = (error) => {
      console.error("[WEBSOCKET] ERROR", error);
      this.setConnectionState((prev) => ({
        ...prev,
        isSocketConnect: false,
      }));
    };

    this.webSocket.onmessage = (evt) => {
      const message = JSON.parse(evt.data) as SignalingMessage;
      switch (message.signalingType) {
        case "ClientEntered": {
          this.id = message.content.id;
          this.assignedAddress = message.content.address;
          this.properties = message.content.properties;
          break;
        }

        case "Clients": {
          this.clients = message.content;
          break;
        }

        case "ClientEnter": {
          const index = this.clients.findIndex(
            (c) => c.id === message.content.id
          );

          // index is -1 if the desired if is not owned by any client in previousClients
          if (index === -1) {
            this.clients.push({
              id: message.content.id,
              address: message.content.address,
              properties: message.content.properties,
            });
          }
          break;
        }

        case "ClientExit": {
          this.clients = this.clients.filter(
            (c) => c.id !== message.content.id
          );

          if (message.content.id === this.id) {
            this.webRTCConnection?.onCallEnd();
          }
          break;
        }

        case "Offer": {
          this.webRTCConnection?.onOfferReceived(message);
          break;
        }

        case "Answer": {
          this.webRTCConnection?.onAnswerReceived(message);
          break;
        }

        case "Ice": {
          this.webRTCConnection?.onCandidateReceived(message);
          break;
        }

        default: {
          return;
        }
      }

      this.clients.filter((client) => client.id !== this.id);
      this.setClients([...this.clients]);
    };
  }

  setWebRTCConnection(webRTCConnection: WebRTCConnection) {
    this.webRTCConnection = webRTCConnection;
  }

  disconnect() {
    if (
      this.webSocket &&
      (this.webSocket.readyState === WebSocket.OPEN ||
        this.webSocket.readyState === WebSocket.CONNECTING)
    ) {
      this.webSocket?.close();
    }

    this.webSocket = undefined;
    this.setClients([]);
  }
}
