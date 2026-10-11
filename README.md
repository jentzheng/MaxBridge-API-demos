# MaxBridge API - demos

## Installation

Clone the repository:

```sh
cd ~/Documents/Max\ 9/Library
git clone https://github.com/jentzheng/MaxBridge-API-demos.git
```

Install dependencies:

```sh
pnpm install && pnpm run build
```

## Usage

### Start server

```sh
# dev env http://localhost:5137
pnpm run dev
# prod env https://localhost:4173 or https://your-lan-ip:4173
pnpm run preview:https
```

### Pages

- Homepage
- Mediapipe FaceLandmark
- Mediapipe Object Detector
- TODO: Mediapipe segmentation
- TODO: p5 or hydra synth

> **Note:**  
> Prod env uses a self-signed SSL certificate (`SELF_SIGN_SSL=true`) so you can access the app over HTTPS.  
> This is required because browsers only allow camera and microphone access on secure origins (HTTPS or localhost).
