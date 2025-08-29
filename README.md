# n4m-jitter-bridge

![screenshot](/screenshot.png)

**n4m-jitter-bridge** is a Node.js-based bridge for real-time communication between Max/MSP/Jitter and web clients. It enables low-latency streaming of Jitter matrix data (video frames) to browsers, supporting both object detection and custom data handling.

A key component is `Transformers.js`, which leverages WebGPU for inference in the browser. You can also dedicate the inference task to a second computer—simply run the web client on another machine and connect it to the bridge, offloading heavy ML inference from your main Max/Jitter workstation.

## Features

- **Jitter Matrix to WebRTC**: Streams Jitter matrix data from Max to browsers using WebRTC for ultra-low latency.
- **TCP Socket Bridge**: Uses a TCP server to receive Jitter matrices from `[jit.net.send]` in Max.
- **WebRTC Peer Management**: Handles multiple browser clients with dynamic peer connection management.
- **Max/MSP Integration**: Communicates with Max/MSP using `max-api` for real-time data exchange and feedback.
- **Object Detection Feedback**: Receives inference results from the browser and sends them back to Max.
- **Mediapipe**

## Installation

Clone the repository:

```sh
cd ~/Documents/Max\ 9/Library
git clone https://github.com/jentzheng/n4m-jitter-bridge.git
```

Install dependencies:

```sh
pnpm install && pnpm run build
# or
npm install && npm run build
```

## Usage

### Start the Node.js Bridge(for dev)

```sh
npm run dev --jit-net-send-port=7474 --remote-server=ws://localhost:5173/ws --username Jitter
```

### In Max/MSP/Jitter

- Open `objectdetection.maxpat`.
- start n4m `script start --jit-net-send-port=7474 --remote-server=ws://localhost:5173/ws --username Jitter`
- Use `[jit.net.send @port 7474]` to send matrix data to the bridge's TCP port.

### In the Browser

```sh
cd socket-server-with-web
npm install
npm run dev
```

- Open <https://localhost:5173> in your browser.
- The app will auto-connect to the bridge using the current host and port.

> **Note:**  
> The development server uses a self-signed SSL certificate (`SELF_SIGN_SSL=true`) so you can access the app over HTTPS.  
> This is required because browsers only allow camera and microphone access on secure origins (HTTPS or localhost).  
> By enabling HTTPS with a self-signed certificate, you can test remote camera capture and WebRTC features locally or on your LAN.

## TODO

- add p5js example
- Add more model inference examples like YOLO-pose or YOLO-seg.
- Support for multiple simultaneous segmentation results.