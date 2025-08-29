import React, { useState, useEffect, useRef, useCallback } from "react";

const resolutions = [
  // {
  //   label: "FHD (1920x1080)",
  //   width: { ideal: 1920, max: 1920 },
  //   height: { ideal: 1080, max: 1080 },
  // },
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

export default function CamaraComponent({
  onCameraStart,
  onCameraStop,
}: {
  onCameraStart?: (stream: MediaStream, videoEle: HTMLVideoElement) => void;
  onCameraStop?: (stream: MediaStream) => void;
}) {
  const camVideoRef = useRef<HTMLVideoElement>(null);

  const [selectedResolution, setSelectedResolution] = useState(() => {
    const resIdx = localStorage.getItem(LOCAL_RES_KEY);
    return resIdx ? resolutions[parseInt(resIdx)] : resolutions[0];
  });
  // const [zoom, setZoom] = useState(1);
  const [canZoom, setCanZoom] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    () => {
      return localStorage.getItem(LOCAL_DEV_KEY) || null;
    }
  );

  const streamRef = useRef<MediaStream | null>(null);

  const handleZoomChange = (newZoom: number) => {
    console.log("trigger", newZoom);
    const stream = streamRef.current;
    if (canZoom && stream) {
      const track = stream.getVideoTracks()[0];
      track.applyConstraints({ advanced: [{ zoom: newZoom }] });
    }
  };

  const handleStartWebcam = useCallback(async () => {
    const video = camVideoRef.current;
    if (!video || !selectedDeviceId) return;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    const { width, height } = selectedResolution;

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: selectedDeviceId },
        width,
        height,
      },
    });

    const track = mediaStream.getVideoTracks()[0];
    const caps = track.getCapabilities();
    if (caps.zoom) {
      setCanZoom(true);
    }

    video.srcObject = mediaStream;
    streamRef.current = mediaStream;

    if (onCameraStart) {
      onCameraStart(mediaStream, video);
    }
  }, [selectedDeviceId, selectedResolution, onCameraStart]);

  const handleStopWebcam = useCallback(async () => {
    const mediaStream = streamRef.current;
    if (!mediaStream) {
      return;
    }

    mediaStream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (onCameraStop) {
      onCameraStop(mediaStream);
    }
  }, [onCameraStop]);

  const handleFullscreen = useCallback(() => {
    const video = camVideoRef.current;
    if (!video) return;
    if ("webkitEnterFullscreen" in video) {
      // @ts-ignore
      video.webkitEnterFullscreen(); // for iOS Safari
    } else if (video.requestFullscreen) {
      video.requestFullscreen(); // Android, desktop
    }
  }, []);

  // grab input devices
  useEffect(() => {
    (async () => {
      await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0) {
          const localDevId = localStorage.getItem(LOCAL_DEV_KEY);
          const found = videoInputs.find((d) => d.deviceId === localDevId);
          if (localDevId && found) {
            setSelectedDeviceId(localDevId);
          } else {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      });
    })();
  }, []);

  // init start camera
  useEffect(() => {
    if (!selectedDeviceId || !selectedResolution) {
      return;
    }
    handleStartWebcam();
  }, [selectedDeviceId, selectedResolution, handleStartWebcam]);

  useEffect(() => {
    if (selectedDeviceId) {
      localStorage.setItem(LOCAL_DEV_KEY, selectedDeviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    const idx = resolutions.findIndex(
      (r) => r.label === selectedResolution.label
    );
    if (idx >= 0) {
      localStorage.setItem(LOCAL_RES_KEY, idx.toString());
    }
  }, [selectedResolution]);

  return (
    <div className="overflow-hidden  relative h-full max-h-full">
      <video
        ref={camVideoRef}
        autoPlay
        playsInline
        controls={false}
        className="  h-full  w-auto m-auto  object-contain bg-black pointer-events-none"
      />

      <div
        className="absolute left-0 bottom-0 w-full p-2"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        {canZoom && (
          <input
            type="range"
            className="range block mx-auto mb-10"
            min={1}
            defaultValue={1}
            max={10}
            step={0.5}
            // value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
          />
        )}
        <div className="flex flex-wrap gap-2 w-full justify-center">
          <div className="dropdown dropdown-top">
            <button tabIndex={0} className="btn btn-sm btn-secondary">
              {videoDevices.find((d) => d.deviceId === selectedDeviceId)?.label}
            </button>
            <ul tabIndex={0} className="dropdown-content menu p-2 bg-base-100">
              {videoDevices.map((device) => (
                <li key={device.deviceId}>
                  <button
                    className={
                      selectedDeviceId === device.deviceId ? "font-bold" : ""
                    }
                    onClick={() => setSelectedDeviceId(device.deviceId)}
                  >
                    {device.label || device.deviceId}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="dropdown dropdown-top">
            <label
              tabIndex={0}
              className="btn   btn-sm btn-secondary flex items-center gap-1 cursor-pointer"
              title="resolution"
            >
              <span className="text-xs">{selectedResolution.label}</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
            >
              {resolutions.map((res, index) => (
                <li key={index}>
                  <button
                    className={
                      selectedResolution.label === res.label ? "font-bold" : ""
                    }
                    onClick={() => setSelectedResolution(res)}
                  >
                    {res.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="btn btn-sm btn-primary"
            onClick={handleStartWebcam}
          >
            Start
          </button>
          <button className="btn btn-sm btn-warning" onClick={handleStopWebcam}>
            Stop
          </button>

          <button className="btn btn-sm" onClick={handleFullscreen}>
            Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
}
