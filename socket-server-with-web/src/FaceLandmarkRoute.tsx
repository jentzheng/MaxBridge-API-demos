import { useCallback, useEffect, useRef } from "react";
import { useConnection } from "./utils/hooks";
import CamaraComponent from "./components/Camera";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export const FaceLandmarkRoute = () => {
  const { webRTCConnection, connectionState } = useConnection();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const startDetection = useCallback(
    async (videoEle: HTMLVideoElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const vision = await FilesetResolver.forVisionTasks(
        // "/models/@mediapipe/task-vision/wasm"
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const facelanmark = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU",
        },
        numFaces: 1,
        // outputFaceBlendshapes: true,
        runningMode: "VIDEO",
      });

      const detectLoop = () => {
        const now = performance.now();

        const results = facelanmark!.detectForVideo(videoEle, now);

        webRTCConnection?.dc?.send(
          JSON.stringify({
            from: webRTCConnection.signalingClient.properties.username,
            type: "facelandmark",
            message: results,
          })
        );

        if (window.max) {
          if (results.faceLandmarks.length > 0) {
            window.max.setDict("face_landmarkdict", {
              faceLandmarks: results.faceLandmarks,
            });
            window.max.outlet("update");
          }
        }

        // console.log(results);
        // setLandmarkData(results);
        // draw overlay
        if (
          canvas &&
          results &&
          results.faceLandmarks &&
          results.faceLandmarks.length > 0
        ) {
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = videoEle.videoWidth;
          canvas.height = videoEle.videoHeight;
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 1;
          results.faceLandmarks.forEach((landmarks: any) => {
            landmarks.forEach((pt: any) => {
              ctx.beginPath();
              ctx.arc(
                pt.x * canvas.width,
                pt.y * canvas.height,
                2,
                0,
                2 * Math.PI
              );
              ctx.fillStyle = "#ff0000";
              ctx.fill();
            });
          });
        }
      };

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(detectLoop, 33); // 30fps
    },

    [canvasRef, webRTCConnection]
  );

  const handleCameraStart = useCallback(
    async (stream: MediaStream, video: HTMLVideoElement) => {
      startDetection(video);

      if (
        !webRTCConnection ||
        !webRTCConnection.pc ||
        connectionState?.peerState !== "connected"
      ) {
        return;
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trans = webRTCConnection.pc.getTransceivers();
        if (trans.length > 0) {
          await trans[0].sender.replaceTrack(videoTrack);
          trans[0].direction = "sendrecv";
        }
      }
      console.log("current trans", webRTCConnection.pc.getTransceivers());
    },
    [webRTCConnection, connectionState, startDetection]
  );

  const handleCameraStop = useCallback(
    async (stream: MediaStream) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!webRTCConnection?.pc) return;

      console.log("Camera stopped, stream:", stream);
      const sender = webRTCConnection.pc
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        await sender.replaceTrack(null);
      }
      stream.getTracks().forEach((track) => track.stop());
    },
    [webRTCConnection]
  );

  return (
    <div className="relative h-full max-h-full">
      <CamaraComponent
        onCameraStart={handleCameraStart}
        onCameraStop={handleCameraStop}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {/* <div className="absolute overflow-auto right-0 top-0 text-green-400 bg-emerald-950/10 p-4 max-h-10/12 hidden lg:block">
        <pre style={{ margin: 0 }}>{JSON.stringify(landmarkData, null, 2)}</pre>
      </div> */}
    </div>
  );
};
