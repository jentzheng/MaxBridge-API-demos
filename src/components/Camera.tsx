import { useCallback, useEffect, useRef, useState } from "react";

import { WebGLRenderer, type UYVYFrame } from "../libs/webgl";

const resolutions = [
  {
    label: "HD (1280x720)",
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
  },
  {
    label: "SD (640x480)",
    width: { ideal: 640, max: 640 },
    height: { ideal: 480, max: 480 },
  },
  {
    label: "Low (320x240)",
    width: { ideal: 320, max: 320 },
    height: { ideal: 240, max: 240 },
  },
];

const LOCAL_RES_KEY = "camera_resolution";
const LOCAL_DEV_KEY = "camera_deviceId";

type ZoomRange = {
  min: number;
  max: number;
  step: number;
};

type Props = {
  onFrame: (video: HTMLVideoElement, seq: number, uyvyFrame: UYVYFrame) => void;
};

export default function CameraComponent({ onFrame }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<number>(-1);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [resolutionIdx, setResolutionIdx] = useState(() => {
    const index = Number(localStorage.getItem(LOCAL_RES_KEY));
    return index ?? 2;
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() =>
    localStorage.getItem(LOCAL_DEV_KEY),
  );
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  // const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  // const [zoom, setZoom] = useState(1);
  // Get camera list

  const changeDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(LOCAL_DEV_KEY, deviceId);
  }, []);

  const changeResolution = useCallback((index: number) => {
    setResolutionIdx(index);
    localStorage.setItem(LOCAL_RES_KEY, String(index));
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
      })
      .then(() => {
        navigator.mediaDevices.enumerateDevices().then((mediaDevices) => {
          const videoInputs = mediaDevices.filter((d) => d.kind === "videoinput");
          setVideoDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            changeDevice(videoInputs[0].deviceId);
          }
        });
      });
  }, [selectedDeviceId, changeDevice]);

  // Start camera
  // const testCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const startCamera = useCallback(
    async (video: HTMLVideoElement, selectedDeviceId: string, resolutionIdx: number) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedDeviceId },
          width: resolutions[resolutionIdx].width,
          height: resolutions[resolutionIdx].height,
        },
      });
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      video.srcObject = stream;
      return stream;
    },
    [],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedDeviceId || !resolutionIdx) return;
    const stream = startCamera(video, selectedDeviceId, resolutionIdx);
    const renderer = new WebGLRenderer();

    const loop = async (now: number, metadata: VideoFrameCallbackMetadata) => {
      if (metadata.width > 0 && metadata.height > 0) {
        const uyvy = renderer.draw(video);
        onFrame(video, now, uyvy);
      }
      frameRef.current = video.requestVideoFrameCallback(loop);
    };
    frameRef.current = video.requestVideoFrameCallback(loop);

    return () => {
      video.cancelVideoFrameCallback(frameRef.current);
      stream.then((s) =>
        s.getTracks().forEach((track) => {
          track.stop();
        }),
      );
    };
  }, [selectedDeviceId, resolutionIdx, startCamera, onFrame]);

  // const changeZoom = useCallback((value: number) => {
  //   setZoom(value);
  //   trackRef.current?.applyConstraints({
  //     // @ts-expect-error zoom might not be supported in all browsers
  //     advanced: [{ zoom: value }],
  //   });
  // }, []);

  // const containerRef = useRef<HTMLDivElement | null>(null);
  const fullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      // await containerRef.current?.requestFullscreen();
    }
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full bg-black">
      {/* <canvas ref={testCanvasRef} className="absolute w-50 h-50 top-0 left-0 bg-amber-400" /> */}

      <video
        ref={videoRef}
        className="block h-full w-full max-h-full max-w-full object-contain"
        autoPlay
        playsInline
        muted
      />

      <div className="absolute z-20 bottom-0 left-0 w-full bg-black/40 p-2">
        {/* {zoomRange && (
          <input
            type="range"
            className="range range-xs mx-auto mb-2 block w-64 max-w-full"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            aria-label="zoom"
            onChange={(e) => changeZoom(Number(e.target.value))}
          />
        )} */}

        <div className="flex w-full flex-wrap justify-center gap-2">
          <select
            className="select select-sm w-auto max-w-56"
            value={selectedDeviceId ?? ""}
            onChange={(e) => changeDevice(e.target.value)}
          >
            {videoDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>

          <select
            className="select select-sm w-auto"
            value={resolutionIdx}
            onChange={(e) => changeResolution(Number(e.target.value))}
          >
            {resolutions.map((resolution, index) => (
              <option key={resolution.label} value={index}>
                {resolution.label}
              </option>
            ))}
          </select>

          <button className="btn btn-sm btn-warning" onClick={() => trackRef.current?.stop()}>
            Stop
          </button>

          <button className="btn btn-sm" onClick={fullscreen}>
            Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
}
