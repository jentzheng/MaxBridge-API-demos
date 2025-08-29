import { useEffect, useRef } from "react";
import { useConnection } from "./utils/hooks";
import DetectorWorker from "./utils/worker-object-detection?worker";

type Result = {
  type: string;
  detections:
    | [
        {
          bbox: [number, number, number, number];
          coco: [number, number, number, number];
          score: number;
          label: string;
        }
      ]
    | [];
};

export const DetectionRoute = () => {
  const { webRTCConnection, connectionState } = useConnection();
  const inBoundVideoRef = useRef<HTMLVideoElement>(null);
  const canvasEle = useRef<HTMLCanvasElement>(null);
  const lastResultRef = useRef<Result>(null);
  // const detectorWorker = useMemo(() => new DetectorWorker(), []);

  useEffect(() => {
    if (
      !webRTCConnection ||
      !webRTCConnection.pc ||
      connectionState?.peerState !== "connected" ||
      !inBoundVideoRef.current
    ) {
      return;
    }

    const recvs = webRTCConnection.pc.getReceivers();
    if (recvs.length > 0) {
      const track = recvs[0].track;
      const stream = new MediaStream([track]);
      inBoundVideoRef.current.srcObject = stream;
      inBoundVideoRef.current.play();
    }
  }, [webRTCConnection, connectionState, inBoundVideoRef]);

  useEffect(() => {
    const canvas = canvasEle.current;
    const inVideo = inBoundVideoRef.current;
    if (!canvas || !inVideo || !webRTCConnection) return;

    const detectorWorker = new DetectorWorker();

    const ctx = canvas.getContext("2d");

    function drawResult(ctx: CanvasRenderingContext2D) {
      const result = lastResultRef.current;
      if (!result) return;

      ctx.save();
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      ctx.font = "16px monospace";
      ctx.fillStyle = "#00FF00";

      result.detections?.forEach((det) => {
        const [x, y, w, h] = det.coco;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.stroke();
        ctx.fillText(det.label, x, y - 4);
      });

      ctx.restore();
    }

    let rid = 0;

    async function captureLoop() {
      if (!canvas || !ctx || !inVideo || !detectorWorker || !webRTCConnection)
        return;
      canvas.width = inVideo.videoWidth;
      canvas.height = inVideo.videoHeight;

      ctx.drawImage(inVideo, 0, 0);

      const rawImage = {
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
        channels: 4,
      };

      detectorWorker.postMessage(rawImage);

      drawResult(ctx);

      rid = requestAnimationFrame(captureLoop);
    }

    inVideo.onloadeddata = () => {
      rid = requestAnimationFrame(captureLoop);
    };

    detectorWorker.onmessage = (event: MessageEvent) => {
      webRTCConnection.dc?.send(JSON.stringify(event.data));
      lastResultRef.current = event.data;
    };

    return () => {
      cancelAnimationFrame(rid);
      detectorWorker.onmessage = null;
      detectorWorker.terminate();
      console.info("DetectionRoute unmounted");
    };
  }, [inBoundVideoRef, webRTCConnection]);

  return (
    <>
      <video
        className="h-full w-auto m-auto hidden"
        ref={inBoundVideoRef}
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasEle}
        className="block h-full w-full m-auto bg-black "
      />
    </>
  );
};
