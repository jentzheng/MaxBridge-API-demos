import { useCallback } from "react";
import { useConnection } from "./utils/hooks";
import CamaraComponent from "./components/Camera";

export const CameraRoute = () => {
  const { webRTCConnection, connectionState } = useConnection();

  const handleCameraStart = useCallback(
    async (stream: MediaStream) => {
      if (
        !webRTCConnection ||
        !webRTCConnection.pc ||
        connectionState?.peerState !== "connected"
      ) {
        return;
      }
      // camtrack
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trans = webRTCConnection.pc.getTransceivers();
        console.log(trans, "---");

        if (webRTCConnection.pc.getTransceivers().length == 0) {
          webRTCConnection.pc.addTransceiver(videoTrack, {
            direction: "sendonly",
          });
        } else {
          await trans[0].sender.replaceTrack(videoTrack);
          trans[0].direction = "sendonly";
        }
        console.log(webRTCConnection.pc.getTransceivers(), "-after set--");
      }
    },
    [webRTCConnection, connectionState]
  );

  const handleCameraStop = useCallback(
    async (stream: MediaStream) => {
      if (!webRTCConnection?.pc) return;

      stream.getTracks().forEach((track) => track.stop());
      console.log("Camera stopped, stream:", stream);

      const sender = webRTCConnection.pc
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        await sender.track?.stop();
      }
    },
    [webRTCConnection]
  );

  return (
    <CamaraComponent
      onCameraStart={handleCameraStart}
      onCameraStop={handleCameraStop}
    />
  );
};
