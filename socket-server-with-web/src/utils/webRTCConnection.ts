import type { Client, SignalingMessage } from "./signalingClient";
import type SignalingClient from "./signalingClient";

class WebRTCConnection {
  signalingClient: SignalingClient;
  setDataChannel: React.Dispatch<
    React.SetStateAction<RTCDataChannel | undefined>
  >;

  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;

  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  target?: string;

  constructor(
    signalingClient: SignalingClient,
    setDataChannel: React.Dispatch<
      React.SetStateAction<RTCDataChannel | undefined>
    >
  ) {
    this.signalingClient = signalingClient;
    this.signalingClient.setWebRTCConnection(this);
    this.setDataChannel = setDataChannel;

    this.pc = null;
    this.dc = null;

    // Perfect negotiation specific
    this.polite = false;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
  }

  createPeerConnection() {
    this.pc = new RTCPeerConnection();
    this.dc = this.pc.createDataChannel("datachannel");

    // Assing event handlers to the peerConnection, bind (this) if the function calls object features in it
    this.pc.onconnectionstatechange = () => {
      console.log("[WEBRTC] Connection State: ", this.pc?.connectionState);

      this.signalingClient.setConnectionState((prev) => {
        return {
          ...prev,
          peerState: this.pc?.connectionState as string,
        };
      });

      if (this.pc?.connectionState === "disconnected") {
        this.deletePeerConnection();
      }
    };

    this.pc.onsignalingstatechange = () => {
      console.log("[WEBRTC] Signaling State Change: ", this.pc?.signalingState);
    };

    this.pc.onnegotiationneeded = async () => {
      if (this.pc?.signalingState === "have-remote-offer") {
        console.log("[WEBRTC] Already have a remote offer, exiting.");
        return;
      }
      if (this.makingOffer) {
        console.log("[WEBRTC] Already making an offer, exiting.");
        return;
      }
      try {
        this.makingOffer = true;
        this.pc?.setLocalDescription().then(() => {
          const description = this.pc?.localDescription;

          const offerMsg: SignalingMessage = {
            signalingType: "Offer",
            target: this.target!,
            content: description!,
          };

          this.onOfferSend(offerMsg);
        });
      } catch (err) {
        console.error("[onnegotiationneeded]:", err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        const candiateMsg: SignalingMessage = {
          signalingType: "Ice",
          target: this.target,
          content: evt.candidate,
        };
        this.onCandidateSend(candiateMsg);
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setDataChannel(event.channel);
    };

    this.dc.onopen = () => {
      this.signalingClient.setConnectionState((prev) => ({
        ...prev,
        dataChannelState: this.dc?.readyState as string,
      }));
    };
  }

  deletePeerConnection() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.dc) {
      this.dc.onmessage = null;
      this.dc?.close();
    }
  }

  onCandidateSend(msg: Extract<SignalingMessage, { signalingType: "Ice" }>) {
    this.signalingClient.webSocket?.send(JSON.stringify(msg));
  }

  onCandidateReceived(
    msg: Extract<SignalingMessage, { signalingType: "Ice" }>
  ) {
    this.pc?.addIceCandidate(msg.content).catch((error) => {
      console.log("[pc.addIceCandidate]", error);
    });
  }

  onOfferSend(msg: Extract<SignalingMessage, { signalingType: "Offer" }>) {
    this.signalingClient.webSocket?.send(JSON.stringify(msg));
    this.makingOffer = false;
  }

  onAnswerSend(msg: Extract<SignalingMessage, { signalingType: "Answer" }>) {
    this.signalingClient.webSocket?.send(JSON.stringify(msg));
  }

  onOfferReceived(msg: Extract<SignalingMessage, { signalingType: "Offer" }>) {
    console.log("[onSignalOfferReceived]", msg);
    if (this.pc === null) {
      this.createPeerConnection();
    }

    const readyForOffer =
      !this.makingOffer &&
      (this.pc?.signalingState === "stable" ||
        this.isSettingRemoteAnswerPending);

    const offerCollision = !readyForOffer;

    const ignoreOffer = !this.polite && offerCollision;
    if (ignoreOffer) {
      console.log(
        "Potential collision found. Ignoring offer to avoid collision."
      );
      return;
    }

    this.target = msg.sender;

    this.pc
      ?.setRemoteDescription(msg.content)
      .then(() => {
        return this.pc?.createAnswer();
      })
      .then((answer) => {
        return this.pc?.setLocalDescription(answer).then(() => {
          // In the following line, the target becomes the sender and sender becomes target
          const answerMsg: SignalingMessage = {
            signalingType: "Answer",
            sender: this.signalingClient.id!,
            target: this.target!,
            content: this.pc?.localDescription as RTCSessionDescription,
          };

          this.onAnswerSend(answerMsg);
        });
      });
  }

  onAnswerReceived(
    msg: Extract<SignalingMessage, { signalingType: "Answer" }>
  ) {
    this.isSettingRemoteAnswerPending = true;

    this.pc
      ?.setRemoteDescription(msg.content)
      .then(() => {
        this.isSettingRemoteAnswerPending = false;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  onCallStart(clietId: string, properties: Client["properties"]) {
    // Assign the remote address as a target reference
    this.target = clietId;
    // For polite WebRTC negotiation, we need to make sure the webapp has not been there longer than the remote client
    this.polite =
      this.signalingClient.properties?.timeJoined < properties?.timeJoined;

    this.createPeerConnection();
  }

  onCallEnd() {
    this.deletePeerConnection();
  }
}

export default WebRTCConnection;
