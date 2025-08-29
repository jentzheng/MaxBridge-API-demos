import type { SignalingMessage, Client } from "@web/utils/signalingClient";

import net from "node:net";
import wrtc from "@roamhq/wrtc";
import {
  DecodeJitMatrix,
  createJMLPBuffer,
  ParsedBuffer,
  bufferToMatrix,
  rotateRGBA,
} from "./utils";

import MaxApi from "max-api";
import WebSocket from "ws";

const Max: typeof MaxApi | undefined =
  process.env["MAX_ENV"] === "max" ? require("max-api") : undefined;

const config = {
  webSocketServer:
    process.argv.find((v) => v.includes("--remote-server"))?.split("=")[1] ||
    "ws://localhost:5173/ws",
  username:
    process.argv.find((v) => v.includes("--username"))?.split("=")[1] ||
    "Jitter",
  netSocketServerPort:
    process.argv
      .find((v) => v.includes("--jit-net-send-port"))
      ?.split("=")[1] || 7474,
};

console.log(config);
const localId = Math.random().toString(36).slice(2);
const webSocketUrl = new URL(config.webSocketServer);
webSocketUrl.searchParams.set("id", localId);
webSocketUrl.searchParams.set("username", config.username);
webSocketUrl.searchParams.set("role", "Jitter");

const connectWS = function () {
  const reconnectInterval = 10 * 1000;

  const ws = new WebSocket(webSocketUrl, {
    rejectUnauthorized: false,
  });

  ws.on("open", () => {
    console.log("[WebSocket]: socket opened");
  });

  ws.on("error", (err) => {
    console.error("[WebSocket]: ", err.message);
    peers.forEach((peer) => {
      peer.pc.close();
      peer.netSocketClient?.destroy();
    });
    clients.clear();
    peers.clear();

    setTimeout(connectWS, reconnectInterval);
  });

  ws.on("close", () => {
    console.error("[WebSocket]: closed");
    peers.forEach((peer) => {
      peer.pc.close();
      peer.netSocketClient?.destroy();
    });

    clients.clear();
    peers.clear();

    setTimeout(connectWS, reconnectInterval);
  });

  ws.on("message", async function message(data) {
    const message: SignalingMessage = JSON.parse(data.toString());

    if (message.signalingType === "ClientEnter") {
      clients.set(message.content.id, message.content);

      createPeerConnection(
        message.content.id,
        ws,
        message.content.properties.jitRecvPort as string
      );
    }

    if (message.signalingType === "ClientExit") {
      clients.delete(message.content.id);
      removePeerConnection(message.content.id);

      console.log(peers);
    }

    if (message.signalingType === "Clients") {
      message.content.forEach((client) => {
        clients.set(client.id, client);
      });

      Max && Max.post(`Clients size: ${clients.size}`);
    }

    if (message.signalingType === "Offer") {
      const { sender: remoteId, target: localId, content } = message;

      if (!remoteId || !content) return;
      const clientInfo = clients.get(remoteId);

      const pc =
        peers.get(remoteId)?.pc ??
        createPeerConnection(
          remoteId,
          ws,
          clientInfo?.properties["jitRecvPort"] as string
        );

      try {
        await pc.setRemoteDescription(content);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const answerMessage: SignalingMessage = {
          sender: localId,
          target: remoteId,
          signalingType: "Answer",
          content: answer,
        };
        ws.send(JSON.stringify(answerMessage));
      } catch (error) {
        console.log("Fail to set remote offer desc:", error);
      }
    }

    if (message.signalingType === "Answer") {
      const { sender: remoteId, target: localId, content } = message;
      if (!remoteId || !content) return;
      const pc = peers.get(remoteId)?.pc;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(content);
      } catch (error) {
        console.log("Fail to set remote answer desc:", error);
      }
    }

    if (message.signalingType === "Ice") {
      const { sender: remoteId, target: localId, content } = message;
      if (!remoteId || !content) return;
      const pc = peers.get(remoteId)?.pc;
      if (!pc) return;
      await pc.addIceCandidate(content);
    }
  });

  return ws;
};

connectWS();

const peers = new Map<
  string,
  {
    pc: RTCPeerConnection;
    ws: WebSocket;
    netSocketClient?: net.Socket;
  }
>();

const clients = new Map<string, Client>();

// local video source
const videoSource = new wrtc.nonstandard.RTCVideoSource();
const stream = new wrtc.MediaStream();
const videoTrack = videoSource.createTrack();

const createPeerConnection = (
  remoteId: string,
  ws: WebSocket,
  jitRecvPort?: string
) => {
  const pc = new wrtc.RTCPeerConnection();

  pc.onsignalingstatechange = () => {
    console.log("onsignalingstatechange", pc.signalingState);
  };

  pc.onnegotiationneeded = async () => {
    console.log("onnegotiationneeded:", pc.signalingState);
    if (pc.signalingState === "have-remote-offer") {
      console.log("[WEBRTC] Already have a remote offer, exiting.");
      return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const offerMsg: SignalingMessage = {
      sender: localId,
      target: remoteId,
      signalingType: "Offer",
      content: offer,
    };

    ws.send(JSON.stringify(offerMsg));
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateMessage: SignalingMessage = {
        signalingType: "Ice",
        sender: localId,
        target: remoteId,
        content: event.candidate,
      };
      ws.send(JSON.stringify(candidateMessage));
    }
  };

  pc.onconnectionstatechange = (evt) => {
    if (pc.connectionState === "failed") {
      pc.restartIce();
    }

    if (pc.connectionState === "closed") {
      removePeerConnection(remoteId);
      peers.delete(remoteId);
    }
  };

  pc.ondatachannel = (event) => {
    const dc = event.channel;
    dc.onopen = () => {
      console.log(`DC ${dc.label}: Opened`);
    };
    dc.onerror = (err) => {
      console.error("[DC]:", err);
    };
    dc.onclose = () => {
      console.log("[DC]: Closed");
    };
    dc.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      Max && Max.outlet(msg);
    };
  };

  pc.addTrack(videoTrack, stream);

  pc.ontrack = (event) => {
    console.log(
      "📹 Got track from client",
      event.track.kind,
      "state",
      event.track.readyState
    );

    event.track.onmute = () => {
      console.log("event.track.onmute");
    };

    event.track.onunmute = () => {
      console.log("event.track.onunmute");
    };

    if (jitRecvPort) {
      const client = new net.Socket();
      const sink = new wrtc.nonstandard.RTCVideoSink(event.track);
      const peer = peers.get(remoteId);
      if (peer) {
        peer.netSocketClient = client;
      }

      client
        .connect(parseInt(jitRecvPort))
        .on("connect", () => {
          console.log(`[jit.net.recv @port ${jitRecvPort}] connected`);
          sink.onframe = ({ frame }) => {
            const { width, height, data, rotation } = frame;

            // Frame is in I420 format, convert to RGBA
            const rgbaBuffer = new Uint8Array(width * height * 4); // 4 bytes per pixel
            wrtc.nonstandard.i420ToRgba(
              {
                width,
                height,
                data, // I420 raw data
              },
              {
                width,
                height,
                data: rgbaBuffer,
              }
            );
            const rotated = rotateRGBA(rgbaBuffer, width, height, rotation);
            const buffer = bufferToMatrix({
              width: rotated.width,
              height: rotated.height,
              data: rotated.data,
            });

            const ok = client.write(buffer, (err) => {
              if (err) console.error("Write error:", err);
            });
          };
        })
        .on("error", (err) => {
          sink.stop();
          console.error(
            `❌ [jit.net.recv @port ${jitRecvPort}] connection error`
          );
        });
    }
  };

  peers.set(remoteId, { pc, ws });
  return pc;
};

const removePeerConnection = (remoteId: string) => {
  const peer = peers.get(remoteId);
  if (!peer) return;

  peer.netSocketClient?.destroy();

  peer.pc.ontrack = null;
  peer.pc.ondatachannel = null;
  peer.pc.onconnectionstatechange = null;
  peer.pc.onicecandidate = null;
  peer.pc.onsignalingstatechange = null;
  peer.pc.onnegotiationneeded = null;
  peer.pc.close();

  peers.delete(remoteId);
};

if (config.netSocketServerPort) {
  const netSocketServer = net.createServer((socket) => {
    const decodeJitMatrix = new DecodeJitMatrix();
    socket
      .pipe(decodeJitMatrix) // buffer to {data, dim, ...}
      .on("data", (parsedBuffer: ParsedBuffer) => {
        const { time: clientTime, serverStart, data, dim } = parsedBuffer;

        const width = dim[1];
        const height = dim[2];
        const i420Buffer = new Uint8Array(width * height * 1.5);

        wrtc.nonstandard.rgbaToI420(
          {
            width,
            height,
            data: new Uint8Array(data),
          },
          {
            width,
            height,
            data: i420Buffer,
          }
        );

        videoSource.onFrame({
          data: i420Buffer,
          width,
          height,
        });

        const now = performance.now();
        const jmlpBuffer = createJMLPBuffer(clientTime, serverStart, now);
        socket.write(jmlpBuffer); // Not sure if this is needed to tell [jit.net.send] a frame is received
      });
  });

  netSocketServer
    .listen(config.netSocketServerPort)
    .on("connection", () => {
      console.log(
        `[jit.net.send @port ${config.netSocketServerPort}] connected`
      );
    })
    .on("error", (err) => {
      console.error(`[jit.net.send @port ${config.netSocketServerPort}]`, err);
    });
}

if (Max) {
  Max.addHandler("getClients", async () => {
    const dict_out = Array.from(clients.values()).map((client) => {
      return {
        id: client.id,
        username: String(client.properties.username),
      };
    });

    await Max.outlet({ clients: dict_out });
  });
}
