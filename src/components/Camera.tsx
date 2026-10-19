import { useCallback, useEffect, useRef, useState } from "react";

import { WebGLRenderer, type UYVYFrame } from "../libs/webgl";

const resolutions = [
  {
    label: "Full HD (1920x1080)",
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
  },
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

function useDevice() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API is unavailable. Use HTTPS or localhost.");
      return;
    }

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const permissionStatus = await navigator.permissions.query({ name: "camera" });
      setPermissionStatus(permissionStatus);
      const audioInputs = mediaDevices.filter((d) => d.kind === "audioinput");
      const videoInputs = mediaDevices.filter((d) => d.kind === "videoinput");
      setAudioInputs(audioInputs);
      setVideoInputs(videoInputs);
      return { audioInputs, videoInputs, permissionStatus };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    const handleDeviceChange = () => {
      console.log("Device change detected");
      refreshDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  // useEffect(() => {
  //   if (!permissionStatus) return;
  //   const handlePermissionChange = () => {
  //     console.log("Permission status changed", permissionStatus.state);
  //   };
  //   permissionStatus.addEventListener("change", handlePermissionChange);
  //   return () => {
  //     permissionStatus.removeEventListener("change", handlePermissionChange);
  //   };
  // }, [refreshDevices, permissionStatus]);

  return { permissionStatus, audioInputs, videoInputs, error, refreshDevices };
}

export default function CameraComponent({ onFrame }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<number>(-1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const { audioInputs, videoInputs, permissionStatus, error, refreshDevices } = useDevice();

  const [resolutionIdx, setResolutionIdx] = useState(() => {
    const index = Number(localStorage.getItem(LOCAL_RES_KEY));
    return index ?? 2;
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(LOCAL_DEV_KEY);
  });
  // const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  // const [zoom, setZoom] = useState(1);
  // Get camera list

  const switchDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(LOCAL_DEV_KEY, deviceId);
  }, []);

  const changeResolution = useCallback((index: number) => {
    setResolutionIdx(index);
    localStorage.setItem(LOCAL_RES_KEY, String(index));
  }, []);

  // Start camera
  // const testCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const startCamera = useCallback(
    async (selectedDeviceId: string | null, resolutionIdx: number) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: "user",
          width: resolutions[resolutionIdx].width,
          height: resolutions[resolutionIdx].height,
        },
      });

      return stream;
    },
    [],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const video = videoRef.current;
    const renderer = new WebGLRenderer();
    if (!video) return;

    let localStream: MediaStream | null = null;
    let cancelled = false;

    const init = async () => {
      const stream = await startCamera(selectedDeviceId, resolutionIdx);
      const videoTrack = stream.getVideoTracks()[0];
      trackRef.current = videoTrack;
      localStream = stream;
      if (selectedDeviceId === null) {
        const deviceId = videoTrack.getSettings().deviceId;
        if (deviceId) {
          setSelectedDeviceId(deviceId);
          localStorage.setItem(LOCAL_DEV_KEY, deviceId);
        }
      }
      refreshDevices();
      if (cancelled) {
        localStream?.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      // setIsPlaying(true);
    };
    init();

    let lastFrameTime = 0;
    const FRAME_INTERVAL = 1000 / 30; // 30 FPS
    const loop = async (now: number, metadata: VideoFrameCallbackMetadata) => {
      const elapsed = now - lastFrameTime;
      if (elapsed > FRAME_INTERVAL) {
        lastFrameTime = now;
        const uyvy = renderer.draw(video);
        onFrame(video, now, uyvy);
      }
      frameRef.current = video.requestVideoFrameCallback(loop);
    };
    frameRef.current = video.requestVideoFrameCallback(loop);

    return () => {
      cancelled = true;
      video.cancelVideoFrameCallback(frameRef.current);
      localStream?.getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
    };
  }, [onFrame, selectedDeviceId, resolutionIdx, startCamera, refreshDevices, isPlaying]);

  // const changeZoom = useCallback((value: number) => {
  //   setZoom(value);
  //   trackRef.current?.applyConstraints({
  //     // @ts-expect-error zoom might not be supported in all browsers
  //     advanced: [{ zoom: value }],
  //   });
  // }, []);

  // const containerRef = useRef<HTMLDivElement | null>(null);
  // const fullscreen = useCallback(async () => {
  //   const video = videoRef.current;
  //   if (!video) return;

  //   if ("webkitEnterFullscreen" in video) {
  //     // @ts-ignore
  //     video.webkitEnterFullscreen(); // for iOS Safari
  //   }

  //   if (video.requestFullscreen) {
  //     video.requestFullscreen(); // Android, desktop
  //   }

  //   video.play();
  // }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} className="relative flex flex-col h-full w-full bg-black">
      {/* <canvas ref={testCanvasRef} className="absolute w-50 h-50 top-0 left-0 bg-amber-400" /> */}

      {/* <p>
        permissionStatus: {permissionStatus?.name} {permissionStatus?.state}
      </p> */}
      {error && <p className=" bg-red-500 text-white p-2">{error}</p>}

      <video
        ref={videoRef}
        className="block h-full w-full max-h-full max-w-full object-contain"
        autoPlay
        playsInline
        muted
      />

      <div className="absolute z-2 bottom-0 left-0 w-full bg-black/40 p-2">
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

        <div className="flex w-full flex-wrap justify-center gap-1">
          <select
            className="select select-xs w-auto max-w-56"
            value={selectedDeviceId ?? ""}
            onChange={(e) => switchDevice(e.target.value)}
          >
            {videoInputs.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>

          <select
            className="select select-xs w-auto"
            value={resolutionIdx}
            onChange={(e) => changeResolution(Number(e.target.value))}
          >
            {resolutions.map((resolution, index) => (
              <option key={resolution.label} value={index}>
                {resolution.label}
              </option>
            ))}
          </select>

          <button
            className="btn btn-xs btn-warning"
            onClick={() => setIsPlaying((playing) => !playing)}
          >
            {isPlaying ? "Stop" : "Start"}
          </button>

          {/* <button className="btn btn-sm" onClick={fullscreen}>
            Fullscreen
          </button> */}
        </div>
      </div>
    </div>
  );
}
